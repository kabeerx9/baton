import { EventEmitter } from "node:events";
import * as Sentry from "@sentry/node";
import db from "../database";
import { enqueueEvent } from "./outbox/enqueue";
import { errorCode } from "./outbox/error-code";
import { nudgeOutbox } from "./outbox/nudge";
import { isDurableEvent } from "./outbox/routes";

const EVENTS = new EventEmitter();
EVENTS.setMaxListeners(100);
export { currentChannel, eventContext } from "./context";
import { eventContext } from "./context";
import { addDomainBreadcrumb } from "../observability/domain-event";

export type EventPayload<T = unknown> = {
  type: string;
  data: T;
  timestamp: string;
};

export async function shutdownEventBus(): Promise<void> {
  EVENTS.removeAllListeners();
}

/**
 * Publishes an event to the in-memory subscribers. For an event with a
 * durable consumer (events/outbox/routes.ts) it first writes the outbox
 * rows in autocommit: the bridge for callers that publish after their
 * transaction. A caller that already called `enqueueEvent(tx)` must use
 * `publishLive` instead, or the rows are written twice.
 */
export async function publishEvent(
  eventType: string,
  data: unknown,
  options?: { waitForHandlers?: boolean },
): Promise<void> {
  if (isDurableEvent(eventType)) await bridgeEnqueue(eventType, data);
  await publishLive(eventType, data, options);
}

/**
 * The committed change is already final, so a failed bridge insert loses
 * that delivery instead of failing the request. Logs metadata, never data.
 */
async function bridgeEnqueue(eventType: string, data: unknown) {
  try {
    await enqueueEvent(db, eventType, data);
  } catch (error) {
    const errorClass = errorCode(error);
    console.error("Outbox bridge enqueue failed", {
      type: eventType,
      error: errorClass,
    });
    Sentry.captureMessage("Outbox bridge enqueue failed", {
      level: "error",
      tags: { area: "outbox", type: eventType },
      extra: { error: errorClass },
    });
  }
}

/**
 * Publishes to the in-memory subscribers (WebSocket and the handlers not
 * yet on the outbox) and wakes the relay. Writes no outbox row.
 */
export async function publishLive(
  eventType: string,
  data: unknown,
  options?: { waitForHandlers?: boolean },
): Promise<void> {
  let enhancedData = null;
  if (typeof data === "object" && data !== null) {
    const store = eventContext.getStore();
    enhancedData = { ...data, initiatorId: store?.initiatorId };
  }

  const payload: EventPayload = {
    type: eventType,
    data: enhancedData || data,
    timestamp: new Date().toISOString(),
  };

  addDomainBreadcrumb("event", "Event published", { type: eventType });
  try {
    if (options?.waitForHandlers) {
      // EventEmitter.emit discards promises. Bounded producers must await the
      // actual subscriber wrappers before starting their next item.
      for (const listener of EVENTS.listeners(eventType))
        await listener(payload);
    } else {
      EVENTS.emit(eventType, payload);
    }
  } catch (error) {
    console.error("Failed to publish event:", error);
    throw error;
  } finally {
    // Only a durable event can have left a row for the relay.
    if (isDurableEvent(eventType)) nudgeOutbox();
  }
}

export async function subscribeToEvent<T>(
  eventType: string,
  handler: (data: T) => Promise<void>,
): Promise<void> {
  try {
    EVENTS.on(eventType, async (payload: EventPayload<T>) => {
      try {
        await handler(payload.data);
      } catch (error) {
        console.error(`Error processing event ${eventType}:`, error);
      }
    });
  } catch (error) {
    console.error("Failed to subscribe to event:", error);
    throw error;
  }
}

process.on("SIGTERM", () => {
  shutdownEventBus().catch(console.error);
});

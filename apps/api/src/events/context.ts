import { AsyncLocalStorage } from "node:async_hooks";
import type { Channel } from "../utils/request-channel";

// Kept apart from the emitter so code that only reads the request context
// does not depend on the event bus module.
export const eventContext = new AsyncLocalStorage<{
  initiatorId: string;
  channel?: Channel | null;
}>();

export function currentChannel(): Channel | null {
  return eventContext.getStore()?.channel ?? null;
}

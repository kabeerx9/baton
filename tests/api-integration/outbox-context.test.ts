import * as Sentry from "@sentry/node";
import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db from "../../apps/api/src/database";
import { activityOutboxConsumer } from "../../apps/api/src/activity/outbox-consumer";
import { eventContext } from "../../apps/api/src/events/context";
import { enqueueEvent } from "../../apps/api/src/events/outbox/enqueue";
import { nudgeOutbox } from "../../apps/api/src/events/outbox/nudge";
import { startOutboxRelay } from "../../apps/api/src/events/outbox/start-relay";
import {
  currentRequestContext,
  runWithRequestContext,
} from "../../apps/api/src/observability/request-context";
import { resetTestDatabase } from "./helpers/database";
import { outboxTaskFixture, readOutbox } from "./helpers/outbox";

type Seen = {
  context: ReturnType<typeof currentRequestContext>;
  initiatorId?: string;
  tags?: Record<string, unknown>;
  user?: unknown;
};

const events: Sentry.ErrorEvent[] = [];

beforeAll(() => {
  // A client with a transport that sends nothing: events stop in beforeSend.
  Sentry.init({
    dsn: "https://public@sentry.invalid/1",
    defaultIntegrations: false,
    beforeSend: (event) => {
      events.push(event);
      return null;
    },
  });
});

afterAll(async () => {
  await Sentry.close();
});

beforeEach(async () => {
  events.length = 0;
  await resetTestDatabase();
});

it("delivers another workspace's row, nudged from a request, as that workspace", async () => {
  const a = await outboxTaskFixture();
  const b = await outboxTaskFixture();
  const seen: Seen[] = [];
  vi.spyOn(activityOutboxConsumer, "deliver").mockImplementation(async () => {
    seen.push({
      context: currentRequestContext(),
      initiatorId: eventContext.getStore()?.initiatorId,
    });
    Sentry.captureMessage("probe");
    return { kind: "delivered" } as never;
  });

  const stop = startOutboxRelay({ pollMs: 60_000 });
  try {
    // No nudge: the row waits for the next tick.
    await enqueueEvent(db, "task.status_changed", {
      taskId: b.task.id,
      projectId: b.project.id,
      type: "status_changed",
    });

    // Request A: its context, its Sentry user and tags, then the nudge.
    await Sentry.withIsolationScope(async (scope) => {
      scope.setUser({ id: a.user.id });
      scope.setTag("workspace_id", a.workspace.id);
      scope.setTag("request_id", "request-a-0001");
      await runWithRequestContext(
        {
          requestId: "request-a-0001",
          workspaceId: a.workspace.id,
          userId: a.user.id,
        },
        () =>
          eventContext.run({ initiatorId: a.user.id }, async () => {
            nudgeOutbox();
          }),
      );
    });

    // A delivered row is deleted.
    await vi.waitFor(async () => expect(await readOutbox()).toHaveLength(0));
  } finally {
    await stop();
  }

  expect(seen).toHaveLength(1);
  expect(seen[0]?.context).toMatchObject({ workspaceId: b.workspace.id });
  expect(seen[0]?.context?.userId).toBeUndefined();
  expect(seen[0]?.context?.requestId).not.toBe("request-a-0001");
  // The row sets its own initiator (none here), never the nudging user.
  expect(seen[0]?.initiatorId).not.toBe(a.user.id);

  expect(events).toHaveLength(1);
  expect(events[0]?.tags).toMatchObject({ workspace_id: b.workspace.id });
  expect(events[0]?.tags?.request_id).toBeUndefined();
  expect(events[0]?.user).toBeUndefined();
  expect(JSON.stringify(events[0])).not.toContain(a.workspace.id);
  expect(JSON.stringify(events[0])).not.toContain(a.user.id);
});

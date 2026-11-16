// Which durable consumers get a row for which event, and the tenant each
// row belongs to. Pure data and pickers: no database or controller imports,
// so the event bus can read it without loading handlers.
import {
  ACTIVITY_EVENT_TYPES,
  toActivityPayload,
} from "../../activity/outbox-payload";

/**
 * `local` consumers write to Postgres in the row's own transaction.
 * `external` consumers call a provider (phase 2). Each lane has its own
 * relay loop, so a slow provider cannot delay local work.
 *
 * The first external consumer must skip rows whose workspace is a demo
 * (`isDemoWorkspace` in workspace/kind): product-tour sandboxes never reach
 * a provider. No external consumer exists yet, so no check runs here today.
 */
export type Lane = "local" | "external";

export type ConsumerName = "activity";

export const CONSUMER_LANE: Record<ConsumerName, Lane> = {
  activity: "local",
};

export function consumersInLane(lane: Lane): ConsumerName[] {
  return (Object.keys(CONSUMER_LANE) as ConsumerName[]).filter(
    (name) => CONSUMER_LANE[name] === lane,
  );
}

/** The tenant of a row. The insert resolves a project to its workspace. */
export type Scope = { workspaceId: string } | { projectId: string };

type Payload = Record<string, unknown>;

type Route = {
  scope: (data: Record<string, unknown>) => Scope | null;
  consumers: Partial<Record<ConsumerName, (data: unknown) => Payload | null>>;
};

const id = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : null;

const byProject = (data: Record<string, unknown>): Scope | null => {
  const projectId = id(data.projectId);
  return projectId ? { projectId } : null;
};

const toProject = (data: Record<string, unknown>): Scope | null => {
  const projectId = id(data.toProjectId);
  return projectId ? { projectId } : null;
};

const activity = (type: string) => (data: unknown) =>
  toActivityPayload(type, data);

export const OUTBOX_ROUTES: Record<string, Route> = Object.fromEntries(
  ACTIVITY_EVENT_TYPES.map((type) => [
    type,
    {
      scope: type === "task.moved" ? toProject : byProject,
      consumers: { activity: activity(type) },
    },
  ]),
);

export function isDurableEvent(type: string) {
  return Object.hasOwn(OUTBOX_ROUTES, type);
}

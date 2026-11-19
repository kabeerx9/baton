import type { PermissionStatements } from "./statements.js";

/**
 * Actions that a broader action already grants, as "resource:action" to the
 * actions that imply it. `task:update` works on every task, so it covers
 * `task:update_assigned`, which works only on tasks assigned to the caller.
 * The reverse never holds.
 */
const IMPLIED_BY: Readonly<Record<string, readonly string[]>> = {
  "task:update_assigned": ["update"],
};

/** True when `held` (one resource's actions) grants `action`. */
export function holdsAction(
  held: readonly string[] | undefined,
  resource: string,
  action: string,
): boolean {
  if (!held) return false;
  if (held.includes(action)) return true;
  const key = `${resource}:${action}`;
  const implied = Object.hasOwn(IMPLIED_BY, key) ? IMPLIED_BY[key] : undefined;
  return Boolean(implied?.some((broader) => held.includes(broader)));
}

/** True when `granted` holds every action `required` asks for. */
export function permits(
  granted: PermissionStatements,
  required: PermissionStatements,
): boolean {
  for (const [resource, actions] of Object.entries(required)) {
    if (!Object.hasOwn(granted, resource)) return false;
    const held = granted[resource];
    if (!held) return false;
    for (const action of actions) {
      if (!holdsAction(held, resource, action)) return false;
    }
  }
  return true;
}

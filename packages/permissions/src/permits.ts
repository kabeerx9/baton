import type { PermissionStatements } from "./statements.js";

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
      if (!held.includes(action)) return false;
    }
  }
  return true;
}

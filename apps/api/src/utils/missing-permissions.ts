import { holdsAction } from "@baton/permissions";

export function missingPermissions(
  statements: Record<string, readonly string[]> | null,
  required: Record<string, readonly string[]>,
): string[] {
  const missing: string[] = [];
  for (const [resource, actions] of Object.entries(required)) {
    const granted =
      statements && Object.hasOwn(statements, resource)
        ? statements[resource]
        : undefined;
    for (const action of actions) {
      if (!holdsAction(granted, resource, action))
        missing.push(`${resource}:${action}`);
    }
  }
  return missing;
}

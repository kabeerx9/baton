import { DEFAULT_ROLE_NAMES, statement } from "@baton/permissions";

export const MAX_ROLES_PER_WORKSPACE = 25;

/** `owner` is static; the seeded defaults keep their names (record §3, P3). */
export const RESERVED_ROLE_NAMES: readonly string[] = [
  "owner",
  ...DEFAULT_ROLE_NAMES,
];

export function isDefaultRoleName(name: string) {
  return (DEFAULT_ROLE_NAMES as readonly string[]).includes(name);
}

/** Role names are stored lower case, as the provider stored them. */
export function normalizeRoleName(name: string) {
  return name.trim().toLowerCase();
}

/** Resource/action pairs outside the vocabulary, as "resource:action". */
export function unknownPermissions(
  permission: Record<string, string[]>,
): string[] {
  const vocabulary = statement as Record<string, readonly string[]>;
  return Object.entries(permission).flatMap(([resource, actions]) => {
    const known = Object.hasOwn(vocabulary, resource)
      ? vocabulary[resource]
      : undefined;
    if (!known) return [`${resource}:*`];
    return actions
      .filter((action) => !known.includes(action))
      .map((action) => `${resource}:${action}`);
  });
}

/** Each single permission, so a multi-role member holds their union. */
export function eachPermission(permission: Record<string, string[]>) {
  return Object.entries(permission).flatMap(([resource, actions]) =>
    actions.map((action) => ({ [resource]: [action] })),
  );
}

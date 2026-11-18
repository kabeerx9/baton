// Splits a stored or requested role into its trimmed, unique tokens. The
// owner quarantine (assert-stored-owner-role-safe.ts) compares the result.
export function normalizeRoleToken(role: unknown): string | undefined {
  if (
    typeof role !== "string" &&
    !(Array.isArray(role) && role.every((name) => typeof name === "string"))
  ) {
    return undefined;
  }
  const roles: string[] = typeof role === "string" ? [role] : role;
  return [
    ...new Set(
      roles
        .flatMap((name) => name.split(",").map((token) => token.trim()))
        .filter(Boolean),
    ),
  ].join(",");
}

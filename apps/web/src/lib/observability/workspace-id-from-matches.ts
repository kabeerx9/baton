type Match = { params?: Record<string, unknown> };

/** The workspace the current route is scoped to, from the deepest match that names one. */
export function workspaceIdFromMatches(
  matches: readonly Match[],
): string | undefined {
  for (let i = matches.length - 1; i >= 0; i--) {
    const id = matches[i]?.params?.workspaceId;
    if (typeof id === "string" && id) return id;
  }
  return undefined;
}

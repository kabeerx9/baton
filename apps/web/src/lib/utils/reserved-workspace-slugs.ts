const RESERVED_WORKSPACE_SLUGS = new Set([
  ".",
  "..",
  ".well-known",
  "api",
  "assets",
  "auth",
  "dashboard",
  "device",
  "images",
  "invitation",
  "invitations",
  "join",
  "mcp",
  "onboarding",
  "profile-setup",
  "public-project",
  "test-error",
]);

export function isReservedWorkspaceSlug(slug: string): boolean {
  return RESERVED_WORKSPACE_SLUGS.has(slug.toLowerCase());
}

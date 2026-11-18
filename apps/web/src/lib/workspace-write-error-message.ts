import i18n from "i18next";

// Static keys, so the copy bundle check can see every one.
const COPY: Record<string, () => string> = {
  ONLY_OWNER: () => i18n.t("workspace:errors.ONLY_OWNER"),
  OWNER_REQUIRED: () => i18n.t("workspace:errors.OWNER_REQUIRED"),
  MEMBERSHIP_REQUIRED: () => i18n.t("workspace:errors.MEMBERSHIP_REQUIRED"),
  DEMO_WORKSPACE: () => i18n.t("workspace:errors.DEMO_WORKSPACE"),
  ROLE_NAME_RESERVED: () => i18n.t("workspace:errors.ROLE_NAME_RESERVED"),
  ROLE_NAME_TAKEN: () => i18n.t("workspace:errors.ROLE_NAME_TAKEN"),
  DEFAULT_ROLE: () => i18n.t("workspace:errors.DEFAULT_ROLE"),
  ROLE_IN_USE: () => i18n.t("workspace:errors.ROLE_IN_USE"),
  TOO_MANY_ROLES: () => i18n.t("workspace:errors.TOO_MANY_ROLES"),
  ALREADY_OWNER: () => i18n.t("workspace:errors.ALREADY_OWNER"),
  MEMBER_NOT_FOUND: () => i18n.t("workspace:errors.MEMBER_NOT_FOUND"),
  WORKSPACE_CREATION_RESTRICTED: () =>
    i18n.t("workspace:errors.WORKSPACE_CREATION_RESTRICTED"),
};

/**
 * Copy for a failed workspace, member or role write: Baton's own text for a
 * known `ApiError` code, else the server message, else `fallback`.
 */
export function workspaceWriteErrorMessage(error: unknown, fallback: string) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;
  if (typeof code === "string" && code in COPY) return COPY[code]();
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

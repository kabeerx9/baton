import i18n from "i18next";
import { workspaceWriteErrorMessage } from "@/lib/workspace-write-error-message";

/**
 * Copy for a failed leave. The shared copy speaks about another member; a
 * leave is about the caller, so its two refusals get their own text.
 */
export function leaveWorkspaceErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;
  if (code === "ONLY_OWNER")
    return i18n.t("settings:workspaceGeneral.leave.errorOnlyOwner");
  if (code === "DEMO_WORKSPACE")
    return i18n.t("settings:workspaceGeneral.leave.errorDemo");
  return workspaceWriteErrorMessage(
    error,
    i18n.t("settings:workspaceGeneral.leave.toastError"),
  );
}

import { getWorkspaceInvitationEmailCopy } from "./get-workspace-invitation-email-copy";

export function getInvitationEmailSubject(
  inviterName: string,
  workspaceName: string,
  instanceName = "Baton",
) {
  const values: Record<string, string> = {
    inviterName,
    workspaceName,
    instanceName,
  };

  return getWorkspaceInvitationEmailCopy().subject.replace(
    /\{\{(\w+)\}\}/g,
    (_match, key: string) => values[key] ?? "",
  );
}

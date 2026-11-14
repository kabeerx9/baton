import enUS from "../../../../i18n/en-US.json";

export function getWorkspaceInvitationEmailCopy() {
  return enUS.invitations.email;
}

export function getInvitationRoleLabel(role: string) {
  const labels: Record<string, string> = enUS.team.roles;

  return role
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => (Object.hasOwn(labels, name) ? labels[name] : name))
    .join(", ");
}

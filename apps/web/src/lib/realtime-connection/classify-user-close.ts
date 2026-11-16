import type { CloseVerdict } from "./connection-state";

export type UserEndReason = "user-access-revoked";

export function classifyUserClose(
  code: number | undefined,
): CloseVerdict<UserEndReason> {
  if (code === 4001) return "check-session";
  if (code === 1008) return { end: "user-access-revoked" };
  return "retry";
}

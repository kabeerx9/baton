import type { InstancePermission } from "@baton/permissions";
import type { AdminUser } from "@/hooks/queries/admin/use-admin-users";
import type { UserActionType } from "./pending-user-action";

type Options = {
  isSelf: boolean;
  /** The viewer's instance permissions. */
  permissions: readonly InstancePermission[];
};

/** The confirmable actions a directory row offers, in menu order. */
export function getUserActionTypes(
  user: Pick<AdminUser, "emailVerified" | "banned">,
  { isSelf, permissions }: Options,
): UserActionType[] {
  const types: UserActionType[] = [];
  if (permissions.includes("users:credentials")) {
    types.push("sendPasswordReset");
    if (!user.emailVerified)
      types.push("sendVerification", "markEmailVerified");
  }
  if (!isSelf) {
    if (permissions.includes("users:disable"))
      types.push(user.banned ? "reactivate" : "deactivate");
    if (permissions.includes("users:delete")) types.push("delete");
  }
  return types;
}

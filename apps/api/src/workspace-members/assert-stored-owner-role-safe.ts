import { ApiError } from "../errors/api-error";
import { isOwnerRole } from "../project-access/is-owner-role";
import { normalizeRoleToken } from "./normalize-role-token";

export function assertStoredOwnerRoleSafe(role: string | null | undefined) {
  if (isOwnerRole(normalizeRoleToken(role)) && !isOwnerRole(role)) {
    throw new ApiError(403, {
      code: "OWNER_ROLE_REVIEW_REQUIRED",
      message: "A workspace owner must review this role before it can be used.",
    });
  }
}

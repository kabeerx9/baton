import { ApiError } from "../errors/api-error";

export const reservedRoleNameError = () =>
  new ApiError(400, {
    code: "ROLE_NAME_RESERVED",
    message: "owner, admin, member and viewer are built-in role names.",
  });

export const roleNameTakenError = () =>
  new ApiError(409, {
    code: "ROLE_NAME_TAKEN",
    message: "A role with this name already exists in the workspace.",
  });

export const defaultRoleError = () =>
  new ApiError(400, {
    code: "DEFAULT_ROLE",
    message:
      "A built-in role can't be renamed or deleted. You can change its permissions.",
  });

export const roleInUseError = () =>
  new ApiError(409, {
    code: "ROLE_IN_USE",
    message: "Members still have this role. Give them another role first.",
  });

export const roleNotFoundError = () =>
  new ApiError(404, { code: "ROLE_NOT_FOUND", message: "Role not found" });

export const invalidRoleNameError = () =>
  new ApiError(400, {
    code: "INVALID_ROLE_NAME",
    message: "A role name has 1 to 64 characters and no commas.",
  });

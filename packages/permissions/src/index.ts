export { holdsAction, permits } from "./permits.js";
export {
  BUILT_IN_ROLE_STATEMENTS,
  type BuiltInRoleName,
  builtInRoleStatements,
  DEFAULT_ROLE_NAMES,
  type DefaultRoleName,
  defaultRolePayloads,
} from "./roles.js";
export { type PermissionStatements, statement } from "./statements.js";

export {
  WORKSPACE_CAPABILITY_NAMES,
  type WorkspaceCapability,
  workspaceCapabilities,
} from "./capabilities.js";

export {
  BUILT_IN_INSTANCE_ROLES,
  type BuiltInInstanceRole,
  CUSTOM_ROLE_PERMISSIONS,
  type CustomRolePermission,
  INSTANCE_PERMISSIONS,
  INSTANCE_ROLE_NAME_PATTERN,
  type InstancePermission,
  isBuiltInInstanceRole,
  isCustomRolePermission,
  isInstancePermission,
  parseInstanceRoles,
} from "./instance.js";

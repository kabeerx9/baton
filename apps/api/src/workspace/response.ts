import {
  WORKSPACE_CAPABILITY_NAMES,
  type WorkspaceCapability,
} from "@baton/permissions";
import { PROJECT_ACCESS_MODES } from "../project-access/project-access-mode";
import { WORKSPACE_KINDS } from "./kind/workspace-kind";
import { responseTimestamp, z } from "../openapi";

export const workspaceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    logo: z.string().nullable(),
    description: z.string().nullable(),
    createdAt: responseTimestamp,
    kind: z.enum(WORKSPACE_KINDS).openapi({
      description:
        "team for a real workspace; demo for the caller's product-tour sandbox. Lists never include a demo workspace.",
    }),
    role: z.string().nullable().openapi({
      description:
        "The caller's workspace role: a built-in role (owner, admin, member, viewer) or the name of a custom role defined in the workspace. Several roles are comma-separated, for example owner,viewer. Null when an instance admin views a workspace they are not a member of.",
    }),
  })
  .openapi("Workspace");

export const workspaceListSchema = z.array(workspaceSchema);

export const workspaceMemberSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
    role: z.string().openapi({
      description:
        "The member's workspace role: a built-in role (owner, admin, member, viewer) or the name of a custom role defined in the workspace. Several roles are comma-separated, for example owner,viewer.",
    }),
    joinedAt: responseTimestamp,
  })
  .openapi("WorkspaceMember");

export const workspaceMemberListSchema = z.array(workspaceMemberSchema);

export const memberProjectAccessSchema = z
  .object({
    userId: z.string(),
    projectAccess: z.enum(PROJECT_ACCESS_MODES),
    projectIds: z.array(z.string()),
  })
  .openapi("MemberProjectAccess");

export const memberProjectAccessListSchema = z
  .array(memberProjectAccessSchema)
  .openapi({
    description:
      "Members limited to selected projects. Members not listed can access every project. Project IDs only include projects the caller can access.",
  });

const capabilityShape = Object.fromEntries(
  WORKSPACE_CAPABILITY_NAMES.map((name) => [name, z.boolean()]),
) as Record<WorkspaceCapability, z.ZodBoolean>;

export const workspaceCapabilitiesSchema = z
  .object(capabilityShape)
  .openapi("WorkspaceCapabilities", {
    description:
      "Whether the caller's roles (and API key scope, if any) allow each named action in the workspace. Mirrors the checks the API enforces.",
  });

export const workspaceRoleSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    role: z.string(),
    permission: z.record(z.string(), z.array(z.string())),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("WorkspaceRole");

export const workspaceRoleListSchema = z.array(workspaceRoleSchema);

export const deletedIdSchema = z
  .object({ id: z.string() })
  .openapi("DeletedId", { description: "The id of the deleted record." });

export const leftWorkspaceSchema = z
  .object({ workspaceId: z.string() })
  .openapi("LeftWorkspace", {
    description: "The workspace the caller is no longer a member of.",
  });

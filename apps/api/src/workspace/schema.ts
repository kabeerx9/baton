import { PROJECT_ACCESS_MODES } from "../project-access/project-access-mode";
import { z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });

export const workspaceMemberParam = z.object({
  workspaceId: z.string(),
  userId: z.string(),
});

export const workspaceMembersQuery = z.object({
  projectId: z.string().optional().openapi({
    description:
      "Only return members who can access this project, for example to fill an assignee picker.",
  }),
});

export const updateMemberProjectAccessBody = z.object({
  projectAccess: z.enum(PROJECT_ACCESS_MODES).openapi({
    description:
      '"all" gives access to every project in the workspace, including future ones. "selected" limits the member to projectIds.',
  }),
  projectIds: z.array(z.string()).default([]).openapi({
    description:
      'Projects the member can access when projectAccess is "selected".',
  }),
});

export const workspaceRoleParam = z.object({
  workspaceId: z.string(),
  roleId: z.string(),
});

export const createWorkspaceBody = z.object({
  name: z.string().min(1).max(100).openapi({
    description:
      "Shown in the app. The server makes the slug from it; two workspaces may share a name.",
  }),
  description: z.string().max(1000).optional(),
});

export const updateWorkspaceBody = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional().openapi({
    description: "An empty string clears the description.",
  }),
  logo: z.string().max(4096).optional().openapi({
    description: "An image URL. An empty string clears the logo.",
  }),
});

export const updateMemberRoleBody = z.object({
  role: z.string().min(1).openapi({
    description:
      "A built-in role (admin, member, viewer) or a custom role of the workspace. owner is refused: use the ownership transfer.",
  }),
});

export const transferOwnershipBody = z.object({
  userId: z.string().min(1).openapi({
    description: "The member who becomes an owner.",
  }),
});

const permissionMap = z.record(z.string(), z.array(z.string())).openapi({
  description:
    'Resource to actions, for example {"task": ["read", "update"]}. Unknown resources or actions are refused.',
});

export const createWorkspaceRoleBody = z.object({
  role: z.string().min(1).max(64).openapi({
    description:
      "The role name, stored lower case. owner, admin, member and viewer are reserved.",
  }),
  permission: permissionMap,
});

export const updateWorkspaceRoleBody = z.object({
  role: z.string().min(1).max(64).optional().openapi({
    description:
      "A new name. Built-in roles and roles members hold keep their name.",
  }),
  permission: permissionMap.optional(),
});

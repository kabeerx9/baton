import { client } from "@baton/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

const roles = client.workspace[":workspaceId"].roles;

export type WorkspaceRoleBody = InferRequestType<typeof roles.$post>["json"];
export type UpdateWorkspaceRoleBody = InferRequestType<
  (typeof roles)[":roleId"]["$patch"]
>["json"];

export async function getWorkspaceRoles(workspaceId: string) {
  const response = await roles.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function createWorkspaceRole(
  workspaceId: string,
  json: WorkspaceRoleBody,
) {
  const response = await roles.$post({ param: { workspaceId }, json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function updateWorkspaceRole(
  workspaceId: string,
  roleId: string,
  json: UpdateWorkspaceRoleBody,
) {
  const response = await roles[":roleId"].$patch({
    param: { workspaceId, roleId },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

/** Answers the deleted role's `{ id }`. */
export async function deleteWorkspaceRole(workspaceId: string, roleId: string) {
  const response = await roles[":roleId"].$delete({
    param: { workspaceId, roleId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

import { client } from "@baton/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type CreateWorkspaceBody = InferRequestType<
  typeof client.workspace.$post
>["json"];

/** The server makes the slug and adds the caller as owner. */
export async function createWorkspace(json: CreateWorkspaceBody) {
  const response = await client.workspace.$post({ json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

/** The workspaces the consent page offers as the agent's default. */
export async function listConsentWorkspaces() {
  const response = await client.workspace.$get();
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  const workspaces = await response.json();
  return workspaces.map(({ id, name }) => ({ id, name }));
}

import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

/** The caller's team workspaces; the API leaves out demo and archived ones. */
async function getWorkspaces() {
  const response = await client.workspace.$get();
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default getWorkspaces;

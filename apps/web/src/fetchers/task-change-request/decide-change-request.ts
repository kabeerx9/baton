import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

export type Decision = "accept" | "reject" | "cancel";

async function decideChangeRequest(id: string, decision: Decision) {
  const route = client["task-change-request"][":id"][decision];
  const response = await route.$post({ param: { id } });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default decideChangeRequest;

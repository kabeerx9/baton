import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

async function getChangeRequest(id: string) {
  const response = await client["task-change-request"][":id"].$get({
    param: { id },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getChangeRequest;

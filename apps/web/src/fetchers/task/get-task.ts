import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

async function getTask(taskId: string, view: "detail" | "board" = "detail") {
  const response = await client.task[":id"].$get({
    param: { id: taskId },
    query: { view },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();

  return data;
}

export default getTask;

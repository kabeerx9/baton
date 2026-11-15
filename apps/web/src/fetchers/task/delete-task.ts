import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

async function deleteTask(taskId: string) {
  const response = await client.task[":id"].$delete({ param: { id: taskId } });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();

  return data;
}

export default deleteTask;

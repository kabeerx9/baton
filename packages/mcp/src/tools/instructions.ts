/** Sent to every client on initialize, so agents follow the same recipe. */
export const MCP_SERVER_INSTRUCTIONS = `Baton is the team's task board. Work in names and task keys, not ids.

Morning flow:
1. "What tasks do I have?": call list_my_tasks. Leave out workspaceId to use the default workspace. Show each task with its key (for example T-5 or API-3).
2. When the user says "task 2", map it to the key you showed, and use that key from then on.
3. Read one task fully with get_task_by_ticket_id: it returns the task and its comments.
4. Start or finish a task with update_board_item: status "in progress" or "done".
5. Create work with create_board_task. The owner is a person's name or email.

Every status, delete and update result has an "outcome". "applied" means the change is made. "requested" means it waits for someone involved in the task to accept it: tell the user it is waiting for an answer, not that it is done.

If you are in more than one workspace and none is the default, the error lists the workspace names; pass one as workspaceId.`;

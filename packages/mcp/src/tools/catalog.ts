/** Which tools a server lists. `core` keeps an agent's context small. */
export type ToolCatalog = "core" | "all";

export type ToolCatalogOptions = {
  catalog?: ToolCatalog;
  /** The grant's default workspace, chosen on the consent page. */
  defaultWorkspaceId?: string | null;
};

/** The morning flow and the change-request loop, and nothing else. */
export const CORE_TOOLS: ReadonlySet<string> = new Set([
  "list_workspaces",
  "list_my_tasks",
  "get_task_by_ticket_id",
  "create_board_task",
  "update_board_item",
  "add_subtasks",
  "get_board",
  "list_change_requests",
  "answer_change_request",
  "cancel_change_request",
  "create_task_comment",
  "list_workspace_members",
]);

export function isToolListed(name: string, catalog: ToolCatalog = "core") {
  return catalog === "all" || CORE_TOOLS.has(name);
}

export function parseToolCatalog(value: string | undefined): ToolCatalog {
  return value?.trim().toLowerCase() === "all" ? "all" : "core";
}

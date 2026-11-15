# Baton MCP server

`@baton/mcp` holds Baton's MCP (Model Context Protocol) tool catalog and a stdio server, `baton-mcp`. It lives in `packages/mcp` of the [kabeerx9/baton](https://github.com/kabeerx9/baton) monorepo.

## Use the HTTP endpoint first

Every Baton API serves the same tools at `<API origin>/api/mcp` over Streamable HTTP with OAuth. Connect once and sign in once in the browser; the agent refreshes its own access. Use the API origin, not the web origin, when they differ.

| Client | One-time setup |
| --- | --- |
| Claude Code | `claude mcp add --transport http --scope user baton URL`, then `/mcp` > baton > Authenticate. |
| Codex CLI | `codex mcp add baton --url URL`, then `codex mcp login baton`. |
| OpenCode | `opencode mcp add baton --global --url URL`, then `opencode mcp auth baton`. |
| Cursor | `~/.cursor/mcp.json`: `{"mcpServers":{"baton":{"url":"URL"}}}`, then Settings > MCP > Login. |
| Claude Desktop, public HTTPS instance | Settings > Connectors > Add custom connector > `URL`. |
| Headless agents | Header `Authorization: Bearer <API key>` on `URL`. |

`URL` lists the core tools. Append `?tools=all` for the full catalog.

## Use stdio when HTTP cannot reach the API

Use `baton-mcp` for a client that only speaks stdio, or for Claude Desktop with a private instance (its custom connectors call from Anthropic's cloud). It signs in with a Baton API key.

The package is not published to npm. Build it from the repo:

```bash
pnpm install
pnpm --filter @baton/mcp build
```

Then add an entry to your client's MCP config:

```json
{
  "mcpServers": {
    "baton": {
      "command": "node",
      "args": ["/path/to/baton/packages/mcp/dist/index.js"],
      "env": {
        "BATON_API_URL": "https://baton.example.com",
        "BATON_API_KEY": "<key from Settings > Account > Developer>"
      }
    }
  }
}
```

`baton-mcp install` writes this entry for Cursor or Claude Desktop (`baton-mcp install --help`). Add the API key yourself.

| Variable | Description |
|----------|-------------|
| `BATON_API_URL` | Baton API origin (default `http://localhost:1337`). Do not include `/api`. |
| `BATON_API_KEY` | **Required.** A Baton API key, sent as a bearer token and never written to disk. Without it, the server stops at startup and says where to create one. |
| `BATON_MCP_TOOLS` | `all` lists the full catalog. Default: the core tools. |

Requires Node.js 24+.

## Develop from source

From the repo root:

```bash
pnpm install
pnpm --filter @baton/mcp run build
pnpm --filter @baton/mcp run start
pnpm --filter @baton/mcp run test
```

Or run it from the package directory:

```bash
pnpm -C packages/mcp run build
```

The CLI entry points to `./dist/index.js`; point MCP client configs at that file.

## Tools

The core set, listed by default: `list_workspaces`, `list_my_tasks`, `get_task_by_ticket_id` (the task and its comments), `get_board`, `create_board_task`, `add_subtasks`, `update_board_item`, `create_task_comment`, `list_workspace_members`, `list_change_requests`, `answer_change_request`, `cancel_change_request`. Board tools take a workspace id or name; leave it out to use the agent's default workspace or your only one. [BOARD.md](../../BOARD.md) describes them.

The full catalog adds:

- Board: `get_team_history`
- Session: `whoami`, `list_notifications`
- Search: `search`
- Projects: `list_projects`, `get_project`, `create_project`, `update_project`, `list_project_columns`
- Tasks: `list_tasks`, `get_task`, `create_task`, `update_task`, `delete_task`, `move_task`, `update_task_status`, `update_task_assignee`, `update_task_due_date`, `list_task_activity`
- Comments: `list_task_comments`, `update_task_comment`, `delete_task_comment`
- Labels: `list_workspace_labels`, `create_label`, `attach_label_to_task`, `detach_label_from_task`, `delete_label`
- Task relations: `create_task_relation`, `get_task_relations`, `delete_task_relation`
- Change requests: `get_change_request`

A status change or delete on a task you are not involved in (not its creator,
its assignee, or a workspace owner or admin) is not made at once. The tool
result has `outcome: "requested"` and the change request; someone involved
accepts or rejects it. Read `outcome` before you report the change as done.

Call `list_project_columns` before setting a status: the column slugs it
returns are the values `create_task` and `update_task_status` accept.
Call `get_task_by_ticket_id` with a key such as `KAN-12` to retrieve one task
without listing a project. If the same key identifies multiple accessible tasks,
pass `workspaceId` or `projectId` to select one.
`list_workspace_members` resolves the user IDs the assignee tools expect.

## Releasing

The package is not on npm, and the repo has no publish workflow. Bump `version` in `packages/mcp/package.json` when the tools change, so stdio users can tell builds apart.

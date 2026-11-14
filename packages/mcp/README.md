# Baton MCP server

`@baton/mcp` is the MCP (Model Context Protocol) server for Baton. It lives in `packages/mcp` of the [kabeerx9/baton](https://github.com/kabeerx9/baton) monorepo.

It runs over stdio and calls the Baton API with a Baton API key as a bearer token. It exposes the `baton-mcp` CLI.

> **Tip:** Every Baton instance also ships a built-in HTTP MCP endpoint at `/api/mcp`. If your MCP client supports Streamable HTTP transport (e.g. Claude Code), you can connect directly without this package.

## Prerequisites

- Node.js 24+
- A running Baton API (for example `http://localhost:1337`).
- A Baton API key. Create one in Baton under Settings > Account > Developer.

## Environment

| Variable | Description |
|----------|-------------|
| `BATON_API_URL` | Baton API origin (default `http://localhost:1337`). Do not include `/api`. |
| `BATON_API_KEY` | **Required.** A Baton API key (create one under Settings > Account > Developer). The server sends it as a bearer token. Without it, the server stops at startup and says where to create one. |

## Install

**Recommended (no global install):** run the interactive installer with npx:

```bash
npx @baton/mcp
```

npm downloads the package, then an **interactive menu** (arrow keys + Enter) asks **where** to register the server (Cursor user-wide, Cursor project, Claude Desktop, or a custom JSON path). It then merges a `mcpServers` entry that points at this package’s `dist/index.js` with your current Node binary.

In a normal terminal, `npx @baton/mcp` and `baton-mcp` with no subcommand both start the installer. When the process is **not** attached to a TTY (for example when Cursor launches the MCP server with a pipe), the same entry runs the stdio MCP server instead.

To run the server manually from a shell (for example to debug stdio), use:

```bash
npx @baton/mcp serve
```

If you prefer a global install:

```bash
npm install -g @baton/mcp
baton-mcp
```

(`baton-mcp install` is the same installer with an explicit subcommand.)

Non-interactive example (Cursor user config, skip overwrite prompts):

```bash
baton-mcp install --target cursor-user -y
```

Point at a self-hosted API when generating the config:

```bash
baton-mcp install --target cursor-user -y --api-url https://baton.example.com
```

See all options:

```bash
baton-mcp install --help
```

If you are currently inside the local `packages/mcp` package directory, npm may resolve the local workspace package instead of the published one and fail to expose the bin. In that case, either run `npx` from outside `packages/mcp`, or use a local build:

```bash
node dist/index.js
```

The published package includes `dist/`. `prepublishOnly` runs the build before publish.

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

The CLI entry points to `./dist/index.js`. Use `npx @baton/mcp` or `baton-mcp` after a global install so your IDE config points at the resolved path.

## Authentication

The server signs in only with `BATON_API_KEY`. Add it to the `env` of the MCP entry, next to `BATON_API_URL`. The key is sent as a bearer token on every request and is never written to disk by this package.

## Tools

- Session: `whoami`, `list_workspaces`, `list_workspace_members`, `list_notifications`
- Search: `search`
- Projects: `list_projects`, `get_project`, `create_project`, `update_project`, `list_project_columns`
- Tasks: `list_tasks`, `get_task`, `get_task_by_ticket_id`, `create_task`, `update_task`, `delete_task`, `move_task`, `update_task_status`, `update_task_assignee`, `update_task_due_date`, `list_task_activity`
- Comments: `list_task_comments`, `create_task_comment`, `update_task_comment`, `delete_task_comment`
- Labels: `list_workspace_labels`, `create_label`, `attach_label_to_task`, `detach_label_from_task`, `delete_label`
- Task relations: `create_task_relation`, `get_task_relations`, `delete_task_relation`
- Change requests: `list_change_requests`, `get_change_request`, `answer_change_request`, `cancel_change_request`

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

Bump `version` in `packages/mcp/package.json` and merge to `main`. The [publish workflow](../../.github/workflows/publish-mcp.yml) runs the package tests, publishes the new version to npm, and creates a `mcp-v<version>` GitHub release. Nothing is published while the version stays the same, so tool changes reach npm only once the version is bumped.

Publishing a GitHub release manually also works: tag it `mcp-v<version>` with the tag version matching `packages/mcp/package.json` on the tagged commit.

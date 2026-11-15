<p align="center">
  <img src="apps/web/public/logo-dark.svg" alt="Baton" width="300" />
</p>

<p align="center">
  One board for your team. Tasks wait on each other, and people get told when they can continue.
</p>

## What it is

Baton is a self-hosted team task tracker built around one board.

- **Task:** one job with one owner.
- **Feature:** a task with tasks under it. Its column comes from its tasks.
- **Waits on:** a task can wait on other tasks. It cannot be marked done until they are done. Loops are refused.
- **Hand-offs:** when a task you wait on is finished, you get a "You can continue" message (in the app, and in Slack if it is set up). Owners of blocking tasks get a daily "Waiting on you" digest.

[BOARD.md](BOARD.md) has the full model: the words, the rules and where they live in the code.

The stack: a Hono API with PostgreSQL, a React web app, live updates over WebSockets, and optional Redis for more than one API instance.

## Run it locally with pnpm

You need Node.js 24.15+ (or 26+), pnpm 12, and PostgreSQL.

1. Copy `.env.sample` to `.env`.
2. Set `DATABASE_URL` and `AUTH_SECRET` (generate it with `openssl rand -hex 32`).
3. Run `pnpm install`.
4. Run `pnpm dev`.
5. Open http://localhost:5173. The first account completes instance setup.

The API listens on http://localhost:1337 and applies migrations at startup. [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) has the details and troubleshooting.

## Run it with Docker

`compose.yml` builds one image from `Dockerfile.baton` (nginx serves the web app and passes `/api` to the API) and starts PostgreSQL next to it.

1. Copy `.env.sample` to `.env`.
2. Set `POSTGRES_PASSWORD` and `AUTH_SECRET`.
3. Run `docker compose up --build`.
4. Open http://localhost:5173.

[DEPLOY.md](DEPLOY.md) describes a hosted deployment.

## Environment variables

`.env.sample` lists every setting. The main ones:

| Variable | Use |
| --- | --- |
| `BATON_CLIENT_URL` | The browser origin of the web app, for example `http://localhost:5173`. |
| `BATON_API_URL` | The API origin. The Docker image derives it from `BATON_CLIENT_URL`. |
| `DATABASE_URL` | PostgreSQL connection string. `POSTGRES_*` is the alternative. |
| `AUTH_SECRET` | Protects sign-in sessions. Keep it stable. |
| `SMTP_*` | Email for invitations, verification and password resets. |
| `SLACK_BOT_TOKEN` | Optional. Turns on Slack direct messages for hand-offs. |
| `REDIS_URL` | Optional. Only needed for more than one API instance. |
| `BATON_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS` | Optional. Allows notification destinations on private networks. |

## MCP

Agents read and plan the board through MCP. Connect once, sign in once in the browser, and the agent keeps working: it renews its own access with a refresh token. Tools such as `list_my_tasks`, `create_board_task` and `update_board_item` work with names and task keys, not ids.

`URL` below is your API origin plus `/api/mcp`, for example `https://baton.example.com/api/mcp`. Use the API origin, not the web app origin, when they differ. Any host other than `localhost` needs HTTPS.

| Client | One-time setup |
| --- | --- |
| Claude Code | `claude mcp add --transport http --scope user baton URL`, then `/mcp` > baton > Authenticate. |
| Codex CLI | `codex mcp add baton --url URL`, then `codex mcp login baton`. |
| OpenCode | `opencode mcp add baton --global --url URL`, then `opencode mcp auth baton`. |
| Cursor | In `~/.cursor/mcp.json`: `{"mcpServers":{"baton":{"url":"URL"}}}`, then Settings > MCP > Login. |
| Claude Desktop, public HTTPS instance | Settings > Connectors > Add custom connector > `URL`. |
| Claude Desktop, private instance | Use `baton-mcp` over stdio with an API key ([packages/mcp/README.md](packages/mcp/README.md)). |
| Headless agents | Send `Authorization: Bearer <API key>` to `URL`. Create the key under Settings > Account > Developer. |

How sign-in works:

- The consent page names the agent and, when you are in more than one workspace, asks for its default workspace. Board tools use that workspace when you name none.
- Each agent gets its own grant. Access tokens last one hour; the agent refreshes them. A grant ends after 90 days without use, when you revoke it (`DELETE /api/mcp/grants/{id}`), or when your password is reset or your account is banned. Signing out other browser sessions does not disconnect agents.
- `URL` lists a core set of 12 tools. Add `?tools=all` to the URL for the full catalog.
- Browser session tokens do not work on `/api/mcp`. If an agent connected before grants existed, it signs in again once.

## License

MIT. See [LICENSE](LICENSE).

## Credits

Baton is based on Kaneo (https://github.com/usekaneo/kaneo), MIT licensed.

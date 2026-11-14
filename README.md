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

## MCP with an API key

Agents can read and plan the board through MCP. Tools such as `get_board`, `create_board_task` and `update_board_item` work with names and keys, not ids.

1. In Baton, create an API key under Settings > Account > Developer.
2. Build `packages/mcp` with `pnpm --filter @baton/mcp build`.
3. Add the `baton-mcp` binary to your MCP client, with `BATON_API_URL` and `BATON_API_KEY` in its `env`.

Clients that support Streamable HTTP and OAuth can instead connect to `<BATON_API_URL>/api/mcp` and sign in through the browser.

[packages/mcp/README.md](packages/mcp/README.md) has the installer and client examples.

## License

MIT. See [LICENSE](LICENSE).

## Credits

Baton is based on Kaneo (https://github.com/usekaneo/kaneo), MIT licensed.

# Baton

Baton is a hosted, multi-tenant team tracker, deployed on DigitalOcean App Platform with Supabase Postgres; it may become a paid SaaS. Tasks wait on each other, and people get told when they can continue. The Hono API owns domain behavior and authorization; the React app uses its typed client. PostgreSQL stores durable state, events and WebSockets keep clients current, and Redis would carry delivery across API instances if production ever runs more than one.

Teams use Baton to manage active work on one instance the owner operates. Changes reach existing tasks, workspaces, and the live deployment, not just a fresh dev setup. Protect what they rely on: quick boards, straightforward workflows, reliable live updates, and tenant isolation. A change that weakens those needs a compelling product reason.

Treat this guide as a set of defaults. The developer's request takes precedence.

## What matters

Read [BOARD.md](BOARD.md) first: it defines the words, the rules and where they live in code.

- Keep routine work simple. Solve the user's problem with the smallest model that makes the behavior clear. Read the relevant code first, but Baton began as a fork of an upstream open-source project: keep the complexity that serves the hosted product and drop constraints that only made sense upstream.
- Keep modules small. Across the whole repo, give each file one responsibility: one component per file, and pure helpers and types in their own modules next to the code that uses them, with tests beside them. When a file grows a second concern, split it into a folder. Do not extract one-line wrappers; inline those.
- Keep boards fast. Task-heavy views and realtime updates should not move or render more data than they need.
- Keep the hosted instance lean. Judge schema, queries and realtime fan-out for scale, cost and tenancy on one instance serving many workspaces. Production runs one instance without Redis, and local dev does too, so that must keep working. Keep realtime transport behind the broadcast adapter in `apps/api/src/ws/broadcast-adapter.ts`.
- Respect workspace boundaries. A workspace is a tenant: one workspace must never see another's data. The API enforces authentication and permissions; a hidden UI control is not an authorization check. Never leak secrets or private workspace data through responses, logs, events, WebSockets, or MCP.

## Where code lives

- `apps/api` — Hono routes, controllers, database, events, integrations, and WebSockets.
- `apps/web` — React UI, fetchers, TanStack Query hooks, and realtime cache updates.
- `packages/libs` — typed Hono client and URL helpers; `packages/permissions` — permission vocabulary and built-in roles.
- `packages/email` — email templates and SMTP delivery; `packages/editor` — shared rich-text editor setup.
- `packages/mcp` — stdio MCP package (API-key sign-in) and the tool catalog the API's `/api/mcp` endpoint reuses.
- `i18n/en-US.json` — the only UI copy bundle; Baton ships English only.
- `tests/api` and `tests/api-integration` — API tests; `tests/storage-integration` and `tests/e2e` — storage and browser tests.

## Follow a change through

The common mistake is finishing one path while leaving another stale. Check the surfaces your change actually touches:

- API: Keep handlers thin and behavior in controllers. Use `createRoute`, Zod request and response schemas, `HTTPException` for expected failures, and `requireWorkspacePermission` for workspace actions. Middleware declared on `createRoute` runs before validators, so it must read the raw request instead of `c.req.valid()`.
- Client: Use `@baton/libs`, fetchers in `apps/web/src/fetchers/`, and TanStack Query hooks. Update invalidation and visible loading, error, and current states.
- Task writes: A new path that changes a task's status, assignee or existence goes through the consent rules in `apps/api/src/task-change-request/` (BOARD.md, "Who can change a task"). Set status with `statusWrite()` and cancel pending change requests in the same transaction, or accept and the timeout job act on stale tasks.
- Realtime: If a mutation drives activity, notifications, integrations, or live UI, use `publishEvent()` and check WebSocket delivery and cache updates. Redis fan-out must remain optional.
- Data: Put schema and relations in `apps/api/src/database/`. Generate a migration with `pnpm --filter @baton/api db:generate`, inspect its SQL, and account for existing installations.
- Public contracts: Keep Zod validation and OpenAPI descriptions accurate. The spec is served at `/api/openapi`; `tests/api-integration/openapi.test.ts` checks it.
- UI: Put user-facing copy in static i18n keys, with `i18n/en-US.json` as the source. Check accessibility and the reverse action: assign/unassign, connect/disconnect, enable/disable.
- UI primitives: Build new primitives with UI SDK, through `components/ui` or `components/primitives`, never from a feature file. Read `node_modules/@ui-sdk/react/docs/llms.txt` first.
- Other entry points: Consider MCP, API keys, webhooks, and the hosted image (`Dockerfile.baton`, `.do/app.yaml`) when the behavior reaches them.

## Working safely

- Server configuration comes from the root `.env`; Vite-only overrides go in `apps/web/.env.local`.
- Never use production data or credentials for development or tests. Preserve unrelated work in a dirty worktree.
- Stop only processes you started and tracked. Never kill processes by a broad name or path match.
- Root and package `lint` scripts run Vite+ checks without writing; use `pnpm exec vp check --fix` for safe fixes and inspect any formatting changes. `pnpm typecheck` runs the package-specific TypeScript checks.
- Do not commit, push, or open a pull request unless asked. A push to `main` builds and publishes the image; deploys are manual (Deploy in App Platform, or `doctl apps create-deployment <id>`).

## Verifying

Use the smallest proof that covers the behavior. Focused tests and the affected package's typecheck usually suffice; use integration tests for routing, authorization, PostgreSQL, and migrations. For realtime changes, check the event-to-WebSocket-to-cache path. Use a real browser for user-visible flows when requested or when it is the only meaningful proof. Run repo-wide checks for broad cross-package changes or before a requested commit or pull request. Report what ran.

Keep comments for constraints and surprising decisions. Update this guide only when a recurring failure shows that an agent needs a durable rule.

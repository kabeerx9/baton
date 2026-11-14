# Baton

Baton is a fast, simple, self-hosted team tracker built around one board. Tasks wait on each other, and people get told when they can continue. The Hono API owns domain behavior and authorization; the React app uses its typed client. PostgreSQL stores durable state, events and WebSockets keep clients current, and Redis is optional for delivery across API instances.

People use Baton to manage active work on instances they control. Changes reach existing tasks, workspaces, and deployments, not just a fresh dev setup. Protect what they rely on: quick boards, straightforward workflows, reliable live updates, and self-hosting that stays simple. A change that weakens those needs a compelling product reason.

Treat this guide as a set of defaults. The developer's request takes precedence.

## What matters

Read [BOARD.md](BOARD.md) first: it defines the words, the rules and where they live in code.

- Keep routine work simple. Solve the user's problem with the smallest model that makes the behavior clear. Read the relevant code first, but do not keep complexity just because it is already there.
- Keep modules small. Across the whole repo, give each file one responsibility: one component per file, and pure helpers and types in their own modules next to the code that uses them, with tests beside them. When a file grows a second concern, split it into a folder. Do not extract one-line wrappers; inline those.
- Keep boards fast. Task-heavy views and realtime updates should not move or render more data than they need.
- Keep self-hosting easy. A single instance must work without Redis or another managed service. Support both bundled same-origin and separately hosted API and web deployments.
- Respect workspace boundaries. The API enforces authentication and permissions; a hidden UI control is not an authorization check. Never leak secrets or private workspace data through responses, logs, events, WebSockets, or MCP.

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
- Realtime: If a mutation drives activity, notifications, integrations, or live UI, use `publishEvent()` and check WebSocket delivery and cache updates. Redis fan-out must remain optional.
- Data: Put schema and relations in `apps/api/src/database/`. Generate a migration with `pnpm --filter @baton/api db:generate`, inspect its SQL, and account for existing installations.
- Public contracts: Keep Zod validation and OpenAPI descriptions accurate. The spec is served at `/api/openapi`; `tests/api-integration/openapi.test.ts` checks it.
- UI: Put user-facing copy in static i18n keys, with `i18n/en-US.json` as the source. Check accessibility and the reverse action: assign/unassign, connect/disconnect, enable/disable.
- Other entry points: Consider MCP, API keys, webhooks, and Docker when the behavior reaches them.

## Working safely

- Server configuration comes from the root `.env`; Vite-only overrides go in `apps/web/.env.local`.
- Never use production data or credentials for development or tests. Preserve unrelated work in a dirty worktree.
- Stop only processes you started and tracked. Never kill processes by a broad name or path match.
- Root and package `lint` scripts run Vite+ checks without writing; use `pnpm exec vp check --fix` for safe fixes and inspect any formatting changes. `pnpm typecheck` runs the package-specific TypeScript checks.
- Do not commit, push, open a pull request, or dispatch a release unless asked. Releases run manually from `main` through the Release workflow.

## Verifying

Use the smallest proof that covers the behavior. Focused tests and the affected package's typecheck usually suffice; use integration tests for routing, authorization, PostgreSQL, and migrations. For realtime changes, check the event-to-WebSocket-to-cache path. Use a real browser for user-visible flows when requested or when it is the only meaningful proof. Run repo-wide checks for broad cross-package changes or before a requested commit or pull request. Report what ran.

Keep comments for constraints and surprising decisions. Update this guide only when a recurring failure shows that an agent needs a durable rule.

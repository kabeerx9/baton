# Local development setup

Use Node.js 24.15 or newer in the 24.x line, or Node.js 26+, and pnpm 12.15.0, as declared in the root `package.json`. You also need a local PostgreSQL database. Redis and object storage are optional.

## Configure the API

Create `.env` in the repository root. If you copy `.env.sample`, replace its empty secrets and choose a database address that the API can reach.

```env
BATON_CLIENT_URL=http://localhost:5173
BATON_API_URL=http://localhost:1337
DATABASE_URL=postgresql://baton:YOUR_LOCAL_PASSWORD@localhost:5432/baton
AUTH_SECRET=REPLACE_WITH_A_RANDOM_SECRET
```

Generate the authentication secret with `openssl rand -hex 32`. Keep it stable between runs. It protects authentication.

Create the database and user before starting the API. The API applies committed migrations at startup. Use a development database, never a production database.

An explicit `DATABASE_URL` takes precedence over `POSTGRES_*`. You do not need both. If you choose derived configuration, set `POSTGRES_PASSWORD` and `POSTGRES_HOST=localhost` for a host-native API. The default hostname `postgres` is for containers sharing a Compose network. `POSTGRES_DB` and `POSTGRES_USER` alone do not enable derivation.

The bundled Docker image derives `BATON_API_URL` from `BATON_CLIENT_URL`. Host-native development does not run that entrypoint, so set the two URLs explicitly as above.

## Configure the browser

The API reads the root `.env`. Vite reads frontend overrides from `apps/web/.env.local`.

The default development API address is `http://localhost:1337`. To change it, create:

```env
# apps/web/.env.local
VITE_API_URL=http://localhost:1337
```

Only put public browser configuration in `VITE_*` variables. Never put database passwords, API keys, or provider secrets there. Restart Vite after changing the file.

The production containers use different names: their startup script replaces `BATON_API_URL`, `BATON_CLIENT_URL`, and `BATON_TURNSTILE_SITE_KEY` in the built assets. Editing `VITE_API_URL` in a running container does not change its API address.

## Install and start

From the repository root:

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173. Check API readiness separately:

```bash
curl --fail http://localhost:1337/api/health
```

The first account completes instance setup. Keep this local instance private until you have created it.

## Optional features

`.env.sample` lists every server setting with its default.

- **Uploads:** configure S3-compatible storage. Any S3-compatible store works, for example MinIO. The API and browser must both reach its endpoint.
- **Email:** configure SMTP (`SMTP_HOST` and related settings). It sends invitations, email verification and password resets. Email and password is the only way to sign in; there is no email code or magic-link sign-in.
- **GitHub:** set `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` and register the local callback URL with the GitHub OAuth App. A signed-in user can then link their GitHub account for repository connections. GitHub never signs anyone in or creates an account. The GitHub App (`GITHUB_APP_*`) powers issue and pull request sync.
- **API port:** the API listens on `BATON_API_PORT`, default `1337`. If you change it, change `BATON_API_URL`, `BATON_INTERNAL_API_URL` and `VITE_API_URL` to match. Leave it unset in the bundled image: its nginx and entrypoint expect 1337.
- **MCP:** the built-in endpoint uses `BATON_INTERNAL_API_URL`, defaulting to `http://127.0.0.1:1337`, for internal tool requests. The stdio `baton-mcp` package signs in with an API key (`BATON_API_KEY`).
- **Private-network connections:** `BATON_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS=true` permits internal ntfy, Gotify and webhook notification destinations. Only enable it on a trusted deployment.
- **Redis:** only needed to relay live updates between multiple API instances. Leave it unset for one local API process.
- **Sentry and logs:** see [Sentry and logs](#sentry-and-logs). Leave the DSNs unset if you do not need reporting.

`DISABLE_REGISTRATION=true` limits new accounts to people with a workspace invitation link. `DISABLE_PASSWORD_REGISTRATION=true` turns off sign-up entirely, so an instance admin creates each account. An empty instance still accepts the first account, which completes instance setup.

## Sentry and logs

Sentry is off until a DSN is set. Each side has its own Sentry project and DSN.

| Where | Name | Value |
| --- | --- | --- |
| API, runtime | `SENTRY_DSN` | `baton-api` project DSN. Store it as a secret. |
| API, runtime | `SENTRY_ENVIRONMENT` | `production` (default: `NODE_ENV`). |
| API, runtime | `SENTRY_TRACES_SAMPLE_RATE` | Share of requests traced, `0` to `1`. Default `0`. |
| API, runtime | `SENTRY_PROFILES_SAMPLE_RATE` | Share of traced requests profiled. Default `0`. |
| API, runtime | `LOG_LEVEL` | stdout threshold: `debug`, `info`, `warn` or `error`. Default `info` in production, `debug` otherwise. |
| Web, runtime (bundled image) | `BATON_SENTRY_DSN` | `baton-web` project DSN. It is public; `env.sh` writes it into the browser assets at startup. Only an `https` DSN is accepted; anything else leaves browser Sentry off and logs a warning. |
| Web, runtime (bundled image) | `BATON_SENTRY_ENVIRONMENT` | `production`. Letters, digits, `.`, `-` and `_` only. |
| Web, local Vite | `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT` | In `apps/web/.env.local`. |
| CI, GitHub secrets | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Source map upload for `baton-web`. Passed as BuildKit secrets, so no image layer holds them. Only pushes to `main` upload. |

Recommended starting rates for a small hosted instance: `SENTRY_TRACES_SAMPLE_RATE=0.1` and `SENTRY_PROFILES_SAMPLE_RATE=0`. The browser traces 10% of page loads; that rate is set in `apps/web/src/instrument.ts`. Raise the rates when traffic is low and you need more data. Lower them when the Sentry quota runs short.

The release is the commit SHA. CI passes it as the `SENTRY_RELEASE` build argument; the API reports it, and the web bundle and its uploaded source maps use the same name. Source maps are deleted from the image after the upload, so the browser cannot download them. A failed upload (expired token, Sentry outage) does not fail the build: the `main` build's CI log shows a line starting `SENTRY SOURCEMAP UPLOAD FAILED:`, and that release still reports errors, only with minified stack traces.

What is sent, and what is not:

- Errors: unexpected API errors and 5xx responses, one event each. Expected 4xx refusals are not reported. An `error` log line with an `Error` attribute is also reported.
- Logs: the API writes every line at or above `LOG_LEVEL` to stdout as JSON, with `request_id`, `workspace_id` and `user_id` when known. Only `warn` and `error` lines, plus a few domain events, go to Sentry Logs. The per-request access line stays on stdout. Browser `console.warn` and `console.error` go to Sentry Logs.
- Context: the user is identified by id only (no email, name or IP address). Events carry a `workspace_id` tag, and API events also carry `request_id`.
- Scrubbing: join, reset and invitation tokens, OAuth `code` and `state`, Bearer and Basic credentials, API keys, MCP tokens, session cookies, presigned storage URLs, webhook URLs and email addresses are removed from events, breadcrumbs, spans and logs before they leave the process.
- Session Replay is off on purpose. Its recording stores the page URL (`location.href`), which holds join and reset tokens, and `@sentry/replay` 11.9 has no hook to scrub it. Turn it on only after token routes keep the token out of the URL, or when the SDK can scrub that URL.

To trace one request: take the `X-Request-Id` response header, search the App Platform runtime logs for that `request_id`, then filter Sentry by the `request_id` tag.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| API cannot resolve `postgres` | Use `localhost` in the database URL when the API runs on your host. |
| Database authentication fails | Confirm the database exists and the URL matches its actual user and password. |
| Browser requests reach the wrong API | Check `apps/web/.env.local`, then restart Vite. |
| CORS or WebSocket origin error | Set `BATON_CLIENT_URL` to the exact browser origin. Put additional allowed origins in the comma-separated `CORS_ORIGINS` value. |
| OAuth returns to the wrong address | Check `BATON_API_URL` and the provider callback URL. |
| Sign-in breaks after restarting | Keep `AUTH_SECRET` unchanged and ensure every API process uses the same value. |
| Upload URL cannot be reached | Use an endpoint the browser can resolve, not a Docker-only storage hostname. |

For the hosted deployment, see [docs/deploy.md](docs/deploy.md).

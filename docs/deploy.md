# Deploy Baton: App Platform + Supabase

The hosted instance: DigitalOcean App Platform runs the image CI publishes to GHCR
(`ghcr.io/kabeerx9/baton:latest`, built from `Dockerfile.baton`; nginx serves the web
build on 5173 and proxies `/api` and WebSockets to the API), and the database is a
Supabase Postgres outside the app. The spec is `.do/app.yaml`.

| Part | Where | Detail |
| --- | --- | --- |
| App (web + API) | App Platform, region `nyc` | one service, one instance, `ghcr.io/kabeerx9/baton:latest`, port 5173 |
| Database | Supabase, region `us-east-1` | **session pooler** connection string, TLS required |
| Migrations | the API, at startup | the container runs them before it serves traffic |
| Health check | App Platform | `GET /api/health`, first check delayed 180s for those migrations |
| Backups | GitHub Actions | nightly `pg_dump`, set up separately from this page |
| TLS for the site | App Platform | certificates for the app domain are automatic |

**Keep app and database in the same region.** `nyc` pairs with Supabase East US (North
Virginia, `us-east-1`); `sfo` pairs with West US (North California, `us-west-1`). Every
request crosses that link, and splitting them across the country adds latency to each
one. The spec defaults to `nyc` because the team is mostly in the US.

## 1. Create the Supabase project

In the Supabase dashboard, **New project**:

- **Region**: East US (North Virginia) to match `region: nyc`. Use West US (North
  California) only if you also change the spec to `sfo`.
- **Database password**: generate a long one and store it in your password manager now.
  It is part of `DATABASE_URL`, and changing it later means updating that secret and
  redeploying.
- Leave the free plan selected for now; the caveats are at step 11.

The project takes a couple of minutes to provision.

## 2. Copy the session pooler connection string

Project → **Connect** (or Settings → Database → Connection string) → **Session pooler**
→ **URI**. It looks like:

```
postgresql://postgres.<project-ref>:<password>@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

Use it with two edits: replace `<password>` with the real password, and append
`?sslmode=no-verify`. If
the password contains `@`, `:`, `/`, `?`, `#` or `%`, percent-encode those characters
first, or generate a password from letters and digits:

```
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=no-verify
```

Why the **session** pooler (port **5432**) and not the transaction pooler (**6543**):

- Baton holds a transaction open across several queries in a handler, so the same server
  connection has to stay with the request. Transaction pooling hands each statement to a
  different connection.
- Handlers set `statement_timeout` with `SET LOCAL` semantics
  (`set_config('statement_timeout', …, true)`), which needs one session and its
  transaction.
- Some work takes **session** advisory locks (`pg_try_advisory_lock`, for example
  `apps/api/src/label/deletion-lock.ts`) and pins one client while it queries through the
  pool. A transaction pooler cannot keep those locks attached to the session.
- Prepared statements also expect a stable session.

The session pooler is also the IPv4 route: direct `db.<project-ref>.supabase.co`
connections are IPv6-only on newer projects.

**TLS.** pg-connection-string treats `sslmode=require` as `verify-full`, which fails on
Supabase's own CA; `no-verify` keeps TLS on without the certificate check.

**Pool size.** `DATABASE_POOL_MAX` in the spec is `10`: at most ten pooled sessions per
app instance, on top of whatever `psql` or a backup opens. The pooler has a client limit
that is shared by every client of the project, and each instance's pool counts against it,
so leave room and check the current Supabase limit for your plan before raising it. The
API refuses values below 2 (`apps/api/src/database/pool-config.ts`).

## 3. Create the app from the spec

```sh
doctl auth init                                            # token with apps:create
doctl apps spec validate .do/app.yaml                      # must print the spec, no error
doctl apps create --spec .do/app.yaml                      # prints the app ID
```

In the dashboard instead: **Create App → Other → paste the spec**, or upload the file. No
GitHub connection is needed: App Platform pulls the public image from GHCR.

The spec already sets the pieces that matter: the GHCR image
(`ghcr.io/kabeerx9/baton:latest`, built from `Dockerfile.baton` by CI), `http_port: 5173`,
health check `/api/health` after a 180 s grace (the first boot has to migrate an empty
database), `instance_count: 1`, a 1 vCPU / 1 GB instance, `BATON_CLOUD=true`, and
`BATON_CLIENT_URL=${APP_URL}`. Check the region against step 1 before you create it.

## 4. Fill in the secrets

Nothing secret is in the repository: every secret in the spec declares `type: SECRET` and
carries no value. Set them in the app: **Settings → the `baton` component → Environment
Variables**.

| Key | Required | Value |
| --- | --- | --- |
| `DATABASE_URL` | yes | the session pooler URL from step 2 |
| `AUTH_SECRET` | yes | `openssl rand -base64 32`; set once, never change |
| `NOTIFICATION_SECRET_ENCRYPTION_KEY` | yes | `openssl rand -base64 32`; needed for webhooks |
| `SMTP_PASSWORD` | no | with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_FROM` |
| `SLACK_BOT_TOKEN` | no | Slack DMs and the digest |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | no | with `S3_ENDPOINT` and `S3_BUCKET`, for uploads |
| `GITHUB_*` | no | account linking and the GitHub App webhook |
| `SENTRY_DSN` | no | error tracking |

`AUTH_SECRET` and `NOTIFICATION_SECRET_ENCRYPTION_KEY` must stay stable forever: a new
`AUTH_SECRET` signs everyone out, and a new `NOTIFICATION_SECRET_ENCRYPTION_KEY` makes
stored webhook secrets unreadable. Saving variables redeploys the app.

If you created the app with `doctl`, its first deployment fails within seconds: with no
`DATABASE_URL` the container entrypoint refuses to start rather than guessing a local
database. That is expected. Set the secrets, let the redeploy run, and continue at step 5.
Creating it in the dashboard lets you enter the values before the first deploy.

Keep `.do/app.yaml` as the source for structure, not for values: an `update --spec` run
re-submits the spec with the secrets empty, so check every secret still has a value
afterwards and re-enter any that do not.

## 5. Watch the first deploy run the migrations

The container runs, waits for the database, then migrates it, then starts serving. In
**Runtime Logs** (or `doctl apps logs <app-id> baton --type run`) the order is:

```
🔄 Preparing database startup { source: 'DATABASE_URL', host: 'aws-0-…', port: 5432, … }
🔄 Migrating database...
✅ Database migrated successfully!
API is ready
```

```sh
curl -fsS https://<app>.ondigitalocean.app/api/health     # {"status":"ok"}
```

If the deployment fails, the logs say why: a wrong password, a transaction-pooler URL on
port 6543, a missing `?sslmode=no-verify`, or `AUTH_SECRET` shorter than 32 characters (the API
exits on that; an *empty* `AUTH_SECRET` is worse in a quiet way — the container entrypoint
generates a random one per start, so every deployment signs everyone out). The previous
deployment keeps serving traffic when there is one.

## 6. First account, then invite-only

1. Open the app URL. The first account to sign up becomes the instance admin; create the
   workspace straight away.
2. Invite the team from Members. Without SMTP the email is not sent and the copied link is
   the invitation.
3. Set `DISABLE_REGISTRATION` to `true` in the app's environment variables and save. Open
   signup then needs a valid pending invitation for that address; existing invitations and
   admin-created accounts keep working. `DISABLE_WORKSPACE_CREATION=true` is the matching
   lock for new workspaces.

## 7. Custom domain

1. **Networking → Domains → Add domain**, enter `tracker.example.com`, and add the CNAME
   it shows at your DNS provider (or use DigitalOcean's nameservers). App Platform issues
   the certificate once DNS resolves.
2. Set `BATON_CLIENT_URL` to `https://tracker.example.com` in the environment variables
   and let the app redeploy. This one matters: `${APP_URL}` in the spec resolves to the
   `ondigitalocean.app` domain, so the redirect URLs and cookies would otherwise point at
   the starter domain. Changing it while people are signed in signs them out once.
3. `curl -fsS https://tracker.example.com/api/health` and open the site on the new domain.

## 8. Deploy

Deploys are manual. A push to `main` builds and publishes the image; it does not roll it
out:

1. CI pushes `ghcr.io/kabeerx9/baton:latest` and `ghcr.io/kabeerx9/baton:<commit sha>`
   once the checks pass.
2. Click **Deploy** in the app (or run `doctl apps create-deployment <app-id>`) to pull
   `:latest`. The health check gates the switch: output stays on the old deployment until
   `/api/health` answers, and a failed pull or health check leaves the old one in place.

After the first push, make the package public once: GitHub → **Packages** → `baton` →
**Package settings** → **Change visibility** → **Public**. App Platform cannot pull the
image while it is private.

Migrations run at startup, before the new container serves traffic, and there is no
migration undo. App Platform keeps the old container serving until the new one is healthy,
so for the length of a rollout both versions talk to the same database: migrations should
stay additive, and a release that renames or drops something needs a dump first (the
nightly job in `.github/workflows/` can be run on demand) or Supabase's own backup option
on a paid plan.

## 9. Rollback

**Activity** (or **Deployments**) in the app → pick the previous deployment → **Rollback**.
That reverts the image. Migrations are not undone: if the older image cannot run against
the migrated schema it will say so in the logs, and the way back is a restore.

To restore, load the dump into a fresh Supabase project (or a fresh database in the same
project) and point `DATABASE_URL` at it, keeping `?sslmode=no-verify`. Restoring over the
live database is the disaster path: stop traffic (scale `instance_count` down in the spec)
first.

## 10. Logs

```sh
doctl apps list --format ID,Spec.Name,DefaultIngress,ActiveDeployment.ID
doctl apps logs <app-id> baton --type run --follow     # API + nginx
doctl apps logs <app-id> baton --type build            # image build
```

In the dashboard, **Runtime Logs** and **Build Logs** are the same two streams. The API
logs its own requests, the migration summary and any startup failure; nginx inside the
container logs to stderr as well, so its warnings land in the same place.

## 11. Free-tier caveats, and moving off it

Check current limits before promising anything; they change. On the Supabase free plan,
expect at least:

- **~500 MB** of database storage.
- **Pausing after a week of inactivity.** A paused project refuses connections, so the
  app fails at boot until you resume the project in the Supabase dashboard. Resume it, then
  redeploy the app (or wait for the next restart).
- **No point-in-time recovery and no downloadable backups.** That is why the nightly
  `pg_dump` job exists; make sure it is green before this instance matters.
- Shared CPU and a limited number of pooler client connections, which is why
  `DATABASE_POOL_MAX` stays at 10.

The upgrade is one variable: create the new database (Supabase Pro, or DigitalOcean
Managed Postgres in the same region), load a dump into it, then set `DATABASE_URL` to its
connection string in the app's environment variables and redeploy. Everything else — the
image, the spec, the health check — stays as it is. Keep
`?sslmode=no-verify` on the new URL.

## 12. Known gaps on App Platform

- **Client IPs.** nginx in the image forwards `do-connecting-ip` as the client address
  when the peer is in 10.0.0.0/8 (`apps/web/nginx.baton.conf`). DigitalOcean does not
  document whether it overwrites a client-sent `do-connecting-ip`. After the first deploy,
  send one with a fake address and check the API logs your real IP.
- **One instance only.** `instance_count: 1`: live updates, the event bus and the scheduler
  are in-process. More than one instance also needs Redis (`REDIS_URL` in the spec) so
  WebSocket fan-out reaches clients attached to another instance.
- **No fixed egress IP** unless Dedicated Egress is enabled. Supabase accepts public
  connections by default, so nothing needs allowlisting today. If you later restrict the
  database's allowed IP ranges, enable Dedicated Egress and add that address in Supabase's
  Network Restrictions, because the app's outbound address is not stable without it.

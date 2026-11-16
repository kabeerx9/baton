# Deploy Baton on one VPS

One Ubuntu server runs the whole stack with Docker Compose:

| Container | What it does | Reachable from |
| --- | --- | --- |
| `caddy` | TLS on 80/443, the only public entry point | the internet |
| `baton` | bundled image: nginx serves the web app, `/api` goes to the API on 1337 | Caddy only |
| `postgres` | durable state, named volume | containers on `baton_net` only |
| `backup` | nightly `pg_dump` to S3-compatible storage, retention | nothing |

Run **one** `baton` container. Live updates, the event bus and the scheduler live in
one process; a second instance needs Redis (see the commented service in
`deploy/compose.prod.yml`). Files are only safe if `S3_*` is configured: the container
filesystem is not a backup.

The hosted instance runs somewhere else: DigitalOcean App Platform with a Supabase
Postgres. That path uses the same image and the app spec in `.do/app.yaml`, and is
documented in [App Platform + Supabase](#app-platform--supabase) at the end of this
page; everything in between is the VPS stack.

Commands below run from the repository root on the VPS. `$ENV` is
`--env-file deploy/.env.production`; every `docker compose` call needs it.

## 1. Provision the VPS

Ubuntu 24.04 LTS, **1 GB RAM, 1 vCPU, 25 GB disk** is the default size and runs the whole
stack. Note the public IPv4 (and IPv6 if you use it). Add the swap step below (step 5)
because building the image on the box needs more memory than running it.

The container memory limits in `deploy/compose.prod.yml` are sized for 1 GB: `baton` 512m,
`postgres` 384m, `backup` 256m, `caddy` 128m. They are caps, so a quiet instance uses a
fraction of that; raise them (and the VPS size) if you see the kernel killing containers.

## 2. Point DNS at it

| Type | Name | Value |
| --- | --- | --- |
| A | `tracker.example.com` | the VPS IPv4 |
| AAAA | `tracker.example.com` | the VPS IPv6, if any |

Wait for `dig +short tracker.example.com` to answer with the address. Caddy issues the
certificate on first start and fails retries until DNS is right.

## 3. Firewall

```sh
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp          # restrict to your address if you can
sudo ufw allow 80/tcp          # ACME challenge + redirect to https
sudo ufw allow 443/tcp
sudo ufw allow 443/udp         # HTTP/3; drop this line if you do not want it
sudo ufw enable
```

Only Caddy publishes ports, so this is the whole surface. Postgres and the app have no
host port at all.

## 4. Install Docker

```sh
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

## 5. Add swap

Only the image build needs the extra memory: `pnpm install`, TypeScript and Vite together
want more than 1 GB, and swap is what keeps that build from being killed. The running
stack fits in 1 GB without it. If you build the image in CI and pull it on the server
instead of building here, skip this step and there is no need for swap.

```sh
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h                     # Swap: 2.0Gi listed, Used: 0B at rest
```

## 6. Get the code

```sh
sudo mkdir -p /opt/baton && sudo chown "$USER" /opt/baton
git clone https://github.com/<you>/baton.git /opt/baton
cd /opt/baton
git checkout <the-commit-or-tag-you-want-live>
```

## 7. Fill in the environment

```sh
cp deploy/.env.production.sample deploy/.env.production
chmod 600 deploy/.env.production
$EDITOR deploy/.env.production
```

Required before it will start: `BATON_DOMAIN`, `BATON_CLIENT_URL`, `BATON_ACME_EMAIL`,
`POSTGRES_PASSWORD`, `AUTH_SECRET`, `NOTIFICATION_SECRET_ENCRYPTION_KEY`, and the
`BACKUP_S3_*` values. Generate secrets on the server:

```sh
openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 32   # NOTIFICATION_SECRET_ENCRYPTION_KEY
openssl rand -base64 24   # POSTGRES_PASSWORD
grep -n CHANGE_ME deploy/.env.production   # must print nothing before you continue
```

`AUTH_SECRET` and `NOTIFICATION_SECRET_ENCRYPTION_KEY` must stay stable forever: changing
either signs everyone out, and the latter makes stored webhook secrets unreadable.
`deploy/.env.production` is gitignored; never copy it into an image or a ticket.

Two backup decisions worth making now: use a separate S3 key from the uploads key, and
scope it to the backup bucket only. The backup list is at step 10.

## 8. Start it

```sh
docker compose -f deploy/compose.prod.yml $ENV up -d --build
```

The first build takes several minutes. The containers start in order: Postgres becomes
healthy, the API runs its migrations on boot, then Caddy gets a certificate. On the 1 GB
default the build leans on the swap from step 5, so expect it to be slow; `docker stats`
shows the running stack itself using far less than the box has.

```sh
docker compose -f deploy/compose.prod.yml $ENV ps
curl -fsS https://tracker.example.com/api/health   # {"status":"ok"}
docker compose -f deploy/compose.prod.yml $ENV logs --tail=50 baton caddy
```

## 9. First account, then invite-only

1. Open `https://tracker.example.com`. The first account to sign up becomes the instance
   admin; create the workspace straight away.
2. Invite the team from Members. Invitation links work with no SMTP configured, but the
   email is not sent, so share the link yourself. Set `SMTP_*` in
   `deploy/.env.production` if you want Baton to send them.
3. Once everyone you invited has an account, set `DISABLE_REGISTRATION=true` and apply it:

   ```sh
   docker compose -f deploy/compose.prod.yml $ENV up -d
   ```

   Open signup now needs a valid pending invitation for that email address; existing
   invitations keep working, and admins can still create accounts from the admin area.
   `DISABLE_WORKSPACE_CREATION=true` is the matching lock for new workspaces.

## 10. Check the backups

The `backup` container waits for `BACKUP_SCHEDULE_UTC` (default 03:15 UTC) and repeats
daily. Prove it works now instead of waiting:

```sh
docker compose -f deploy/compose.prod.yml $ENV run --rm --entrypoint /usr/local/bin/backup.sh backup
docker compose -f deploy/compose.prod.yml $ENV logs --tail=20 backup
```

The run prints the uploaded key, for example `baton/postgres/20261116T031500Z.dump`.
Dumps older than `BACKUP_RETENTION_DAYS` are deleted by the same run. Check the bucket
holds the object, and set a lifecycle or versioning policy there if the provider offers
one.

## 11. Restore drill

Do this before you need it, and again after changing anything about backups. It restores
into a scratch database on the same server, never the live one:

```sh
# create the scratch database
docker compose -f deploy/compose.prod.yml $ENV exec -T postgres \
  psql -U baton -d postgres -c 'CREATE DATABASE baton_restore'

# newest dump in the bucket -> baton_restore
docker compose -f deploy/compose.prod.yml $ENV run --rm \
  --entrypoint /usr/local/bin/restore.sh backup latest baton_restore

# the restored data is there
docker compose -f deploy/compose.prod.yml $ENV exec -T postgres \
  psql -U baton -d baton_restore -c 'select count(*) from task'

# clean up
docker compose -f deploy/compose.prod.yml $ENV exec -T postgres \
  psql -U baton -d postgres -c 'DROP DATABASE baton_restore'
```

`restore.sh` also takes `s3://bucket/key.dump` or a local path, and
`RESTORE_DATABASE_URL` restores into a different server. Restoring over the live
database is the disaster path: stop `baton` first, restore into a fresh database, then
point `DATABASE_URL` at it.

## 12. Upgrade

```sh
cd /opt/baton && git fetch --tags && git checkout <new-tag>
docker compose -f deploy/compose.prod.yml $ENV run --rm --entrypoint /usr/local/bin/backup.sh backup
docker compose -f deploy/compose.prod.yml $ENV up -d --build
curl -fsS https://tracker.example.com/api/health
```

Migrations run inside the new container at startup, before it serves traffic, and there
is no migration undo. That is why the backup comes first for any release that touches
the schema. Keep exactly one `baton` container during the switch: an old process does not
know the new consent and status rules.

## 13. Rollback

```sh
cd /opt/baton && git checkout <previous-tag>
docker compose -f deploy/compose.prod.yml $ENV up -d --build
```

If the old image cannot run against the migrated schema (it will say so loudly in the
logs), restore the dump taken in step 12 into a fresh database and point `DATABASE_URL`
at it. Certificates, `postgres_data` and the environment file are untouched by both
directions.

## 14. Move to managed Postgres

Worth doing before taking paying customers: one small VPS runs out of memory before it
runs out of disk, and managed Postgres gives you point-in-time recovery.

1. Create the managed database, and allow this VPS's address in its firewall.
2. Load the current data into it:

   ```sh
   docker compose -f deploy/compose.prod.yml $ENV run --rm \
     --entrypoint /usr/local/bin/backup.sh backup          # fresh dump first
   # then restore it into the managed database (the value is read from the
   # environment, never typed as an argument, so it stays out of `ps`):
   RESTORE_DATABASE_URL='postgresql://user:pass@host:25060/baton?sslmode=require' \
     docker compose -f deploy/compose.prod.yml $ENV run --rm \
     --entrypoint /usr/local/bin/restore.sh backup latest
   ```

   `DATABASE_POOL_MAX` should fit under the plan's connection limit; 10 is fine for one
   API instance.
3. In `deploy/.env.production`, set `DATABASE_URL=` to the managed URL (keep
   `?sslmode=require`). Nothing else in the stack depends on where Postgres lives.
4. `docker compose -f deploy/compose.prod.yml $ENV up -d`, then
   `curl -fsS https://tracker.example.com/api/health` and check the logs for
   `Database migrated successfully`.
5. The local Postgres is now unused. Stop it with
   `docker compose -f deploy/compose.prod.yml $ENV rm -sf postgres`, and remove the
   `postgres` service plus `baton`'s `depends_on` from `deploy/compose.prod.yml` when
   you are ready (otherwise the next `up -d` starts it again). Keep
   `postgres_data` until you have run a restore drill against the managed database.
6. Backups keep working: the `backup` container prefers `DATABASE_URL`, so it dumps the
   managed database. Keep dumps in the bucket you already control.

Provider TLS note, same as `.do/app.yaml`: if the managed server uses a private CA and the
API fails at boot with a certificate error, add `?sslmode=no-verify` to `DATABASE_URL` or
supply the provider's CA bundle. Prefer the CA bundle.

## 15. Local smoke test (not production)

Both deploy files are checked against a throwaway local stack, which is how the composed
configuration was proven. It publishes 80/443 on your machine, uses Caddy's local CA for
`localhost`, and adds a MinIO container as the backup destination:

```sh
docker compose -p baton-deploy-smoke \
  -f deploy/compose.prod.yml -f deploy/compose.smoke.yml \
  --env-file deploy/.env.smoke.sample up -d --build

curl -k https://localhost/api/health                       # {"status":"ok"}
docker compose -p baton-deploy-smoke -f deploy/compose.prod.yml -f deploy/compose.smoke.yml \
  --env-file deploy/.env.smoke.sample run --rm --entrypoint /usr/local/bin/backup.sh backup
docker compose -p baton-deploy-smoke -f deploy/compose.prod.yml -f deploy/compose.smoke.yml \
  --env-file deploy/.env.smoke.sample exec -T postgres psql -U baton -d postgres -c 'CREATE DATABASE baton_restore'
docker compose -p baton-deploy-smoke -f deploy/compose.prod.yml -f deploy/compose.smoke.yml \
  --env-file deploy/.env.smoke.sample run --rm --entrypoint /usr/local/bin/restore.sh backup latest baton_restore

# always remove only this project, including its volumes
docker compose -p baton-deploy-smoke \
  -f deploy/compose.prod.yml -f deploy/compose.smoke.yml \
  --env-file deploy/.env.smoke.sample down -v
```

`curl -k` is expected: nobody trusts Caddy's local CA. Ports 80/443 must be free.

## 16. When something is wrong

- **No certificate.** `docker compose ... logs caddy`. Usually DNS is not resolving yet,
  or port 80/443 is blocked. Only 5 failed validations per domain per hour are allowed;
  wait it out rather than looping.
- **`dependency failed to start: container ... is unhealthy`.** The API logs the reason
  (`docker compose ... logs baton`). Missing `AUTH_SECRET` or `POSTGRES_PASSWORD`, or a
  database that is still starting.
- **Everything is slow or the kernel kills containers.** Check `free -m` and
  `docker stats`. The memory caps are sized for the 1 GB default (`baton` 512m,
  `postgres` 384m); raise the `deploy.resources.limits` in
  `deploy/compose.prod.yml` when you give the box more RAM, and lower
  `DATABASE_POOL_MAX` if the database refuses connections.
- **Disk filling up.** `docker image prune -f` after upgrades, and check
  `BACKUP_RETENTION_DAYS` is not excessive.
- **Everyone signs out at once.** `AUTH_SECRET` changed or was not set.
- **All rate limits trip at once.** `TRUSTED_PROXIES` no longer matches the `baton_net`
  subnet; the API then sees Caddy as every client. Fix the subnet in
  `deploy/compose.prod.yml` and the default in `deploy/.env.production` together.

## App Platform + Supabase

The hosted instance: DigitalOcean App Platform runs the image from `Dockerfile.baton`
(nginx serves the web build on 5173 and proxies `/api` and WebSockets to the API), and
the database is a Supabase Postgres outside the app. The spec is `.do/app.yaml`. The
VPS stack above stays as the self-host and fallback path; nothing in `deploy/` changes.

| Part | Where | Detail |
| --- | --- | --- |
| App (web + API) | App Platform, region `nyc` | one service, one instance, `Dockerfile.baton`, port 5173 |
| Database | Supabase, region `us-east-1` | **session pooler** connection string, TLS required |
| Migrations | the API, at startup | the container runs them before it serves traffic |
| Health check | App Platform | `GET /api/health`, first check delayed 180s for those migrations |
| Backups | GitHub Actions | nightly `pg_dump`, set up separately from this page |
| TLS for the site | App Platform | certificates for the app domain are automatic |

**Keep app and database in the same region.** `nyc` pairs with Supabase East US (North
Virginia, `us-east-1`); `sfo` pairs with West US (North California, `us-west-1`). Every
request crosses that link, and splitting them across the country adds latency to each
one. The spec defaults to `nyc` because the team is mostly in the US.

### 1. Create the Supabase project

In the Supabase dashboard, **New project**:

- **Region**: East US (North Virginia) to match `region: nyc`. Use West US (North
  California) only if you also change the spec to `sfo`.
- **Database password**: generate a long one and store it in your password manager now.
  It is part of `DATABASE_URL`, and changing it later means updating that secret and
  redeploying.
- Leave the free plan selected for now; the caveats are at step 11.

The project takes a couple of minutes to provision.

### 2. Copy the session pooler connection string

Project → **Connect** (or Settings → Database → Connection string) → **Session pooler**
→ **URI**. It looks like:

```
postgresql://postgres.<project-ref>:<password>@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

Use it with two edits: replace `<password>` with the real password, and append
`?sslmode=verify-full` (or `?sslmode=require`, which behaves the same in this driver). If
the password contains `@`, `:`, `/`, `?`, `#` or `%`, percent-encode those characters
first, or generate a password from letters and digits:

```
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full
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

**TLS.** The API passes `DATABASE_URL` straight to `pg` and configures no `ssl` option
of its own (`apps/api/src/database/index.ts`), but node-postgres reads `sslmode` from the
URL, so no code change is needed. Checked against the installed driver (pg 8.23.1):
`?sslmode=require` yields `ssl: {}`, which is TLS with normal certificate verification
against the system CA store; without it there is no TLS at all. `?sslmode=verify-full` is
the same behaviour without the driver's deprecation warning for `require`. Supabase uses a
public CA, so verification passes. Only if a future database uses a private CA and the
API fails at boot with a certificate error would `?sslmode=no-verify` be needed — a CA
bundle would be better, and the API has no setting for one, which would need a code
change.

**Pool size.** `DATABASE_POOL_MAX` in the spec is `10`: at most ten pooled sessions per
app instance, on top of whatever `psql` or a backup opens. The pooler has a client limit
that is shared by every client of the project, and each instance's pool counts against it,
so leave room and check the current Supabase limit for your plan before raising it. The
API refuses values below 2 (`apps/api/src/database/pool-config.ts`).

### 3. Create the app from the spec

```sh
doctl auth init                                            # token with apps:create
doctl apps spec validate .do/app.yaml                      # must print the spec, no error
doctl apps create --spec .do/app.yaml                      # prints the app ID
```

In the dashboard instead: **Create App → Other → paste the spec**, or upload the file. The
first time, App Platform asks for access to the `kabeerx9/baton` GitHub repository so it
can build `main` on every push.

The spec already sets the pieces that matter: Dockerfile build with the repository root as
context, `http_port: 5173`, health check `/api/health` after a 180 s grace (the first boot
has to migrate an empty database), `instance_count: 1`, a 1 vCPU / 1 GB instance,
`BATON_CLOUD=true`, and `BATON_CLIENT_URL=${APP_URL}`. Check the region against step 1
before you create it.

### 4. Fill in the secrets

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

### 5. Watch the first deploy run the migrations

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
port 6543, a missing `?sslmode=…`, or `AUTH_SECRET` shorter than 32 characters (the API
exits on that; an *empty* `AUTH_SECRET` is worse in a quiet way — the container entrypoint
generates a random one per start, so every deployment signs everyone out). The previous
deployment keeps serving traffic when there is one.

### 6. First account, then invite-only

1. Open the app URL. The first account to sign up becomes the instance admin; create the
   workspace straight away.
2. Invite the team from Members. Without SMTP the email is not sent and the copied link is
   the invitation.
3. Set `DISABLE_REGISTRATION` to `true` in the app's environment variables and save. Open
   signup then needs a valid pending invitation for that address; existing invitations and
   admin-created accounts keep working. `DISABLE_WORKSPACE_CREATION=true` is the matching
   lock for new workspaces.

### 7. Custom domain

1. **Networking → Domains → Add domain**, enter `tracker.example.com`, and add the CNAME
   it shows at your DNS provider (or use DigitalOcean's nameservers). App Platform issues
   the certificate once DNS resolves.
2. Set `BATON_CLIENT_URL` to `https://tracker.example.com` in the environment variables
   and let the app redeploy. This one matters: `${APP_URL}` in the spec resolves to the
   `ondigitalocean.app` domain, so the redirect URLs and cookies would otherwise point at
   the starter domain. Changing it while people are signed in signs them out once.
3. `curl -fsS https://tracker.example.com/api/health` and open the site on the new domain.

### 8. Deploy on push

`deploy_on_push: true` in the spec means each push to `main` of `kabeerx9/baton` builds the
image from `Dockerfile.baton` and rolls out a new deployment. The health check gates the
switch: output stays on the old deployment until `/api/health` answers, and a failed build
or health check leaves the old one in place.

Migrations run at startup, before the new container serves traffic, and there is no
migration undo. App Platform keeps the old container serving until the new one is healthy,
so for the length of a rollout both versions talk to the same database: migrations should
stay additive, and a release that renames or drops something needs a dump first (the
nightly job in `.github/workflows/` can be run on demand) or Supabase's own backup option
on a paid plan.

### 9. Rollback

**Activity** (or **Deployments**) in the app → pick the previous deployment → **Rollback**.
That reverts the image. Migrations are not undone: if the older image cannot run against
the migrated schema it will say so in the logs, and the way back is a restore.

To restore, load the dump into a fresh Supabase project (or a fresh database in the same
project) and point `DATABASE_URL` at it, keeping `?sslmode=verify-full`. Restoring over the
live database is the disaster path: stop traffic (scale `instance_count` down in the spec)
first.

### 10. Logs

```sh
doctl apps list --format ID,Spec.Name,DefaultIngress,ActiveDeployment.ID
doctl apps logs <app-id> baton --type run --follow     # API + nginx
doctl apps logs <app-id> baton --type build            # image build
```

In the dashboard, **Runtime Logs** and **Build Logs** are the same two streams. The API
logs its own requests, the migration summary and any startup failure; nginx inside the
container logs to stderr as well, so its warnings land in the same place.

### 11. Free-tier caveats, and moving off it

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
image, the spec, the health check — stays as it is. For Managed Postgres, keep
`?sslmode=require`; if that cluster presents a certificate the driver cannot verify, the
API fails at boot and the only built-in workaround is `?sslmode=no-verify` (a CA bundle
would be better, and the API has no setting for one — that is the one migration that would
need a code change).

### 12. Known gaps on App Platform

- **Client IPs.** App Platform puts the real client address in the `do-connecting-ip`
  header and the *ingress* address in `X-Forwarded-For`. The API derives client IPs from
  the socket peer plus `X-Forwarded-For` (`apps/api/src/utils/client-ip.ts`), and nginx in
  the image forwards `X-Forwarded-For` as it received it. So on App Platform, rate limits
  and audit logs group people by DigitalOcean ingress address instead of by client. The
  fix is a header mapping in `apps/web/nginx.baton.conf` (forward `do-connecting-ip` as the
  client address); it is not made here. `TRUSTED_PROXIES` is set to `127.0.0.0/8,10.0.0.0/8`
  because DigitalOcean does not publish the ingress CIDR and the container only receives
  traffic from that ingress; it keeps the resolver from trusting a forged header.
- **One instance only.** `instance_count: 1`: live updates, the event bus and the scheduler
  are in-process. More than one instance also needs Redis (`REDIS_URL` in the spec) so
  WebSocket fan-out reaches clients attached to another instance.
- **No fixed egress IP** unless Dedicated Egress is enabled. Supabase accepts public
  connections by default, so nothing needs allowlisting today. If you later restrict the
  database's allowed IP ranges, enable Dedicated Egress and add that address in Supabase's
  Network Restrictions, because the app's outbound address is not stable without it.

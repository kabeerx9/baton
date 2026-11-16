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

Commands below run from the repository root on the VPS. `$ENV` is
`--env-file deploy/.env.production`; every `docker compose` call needs it.

## 1. Provision the VPS

Ubuntu 24.04 LTS, 2 vCPU, 2 GB RAM, 40 GB disk (1 GB works if you add swap; the image
build is the memory-hungry step). Note the public IPv4 (and IPv6 if you use it).

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

## 5. Get the code

```sh
sudo mkdir -p /opt/baton && sudo chown "$USER" /opt/baton
git clone https://github.com/<you>/baton.git /opt/baton
cd /opt/baton
git checkout <the-commit-or-tag-you-want-live>
```

## 6. Fill in the environment

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
scope it to the backup bucket only. The backup list is at step 9.

## 7. Start it

```sh
docker compose -f deploy/compose.prod.yml $ENV up -d --build
```

The first build takes several minutes. The containers start in order: Postgres becomes
healthy, the API runs its migrations on boot, then Caddy gets a certificate.

```sh
docker compose -f deploy/compose.prod.yml $ENV ps
curl -fsS https://tracker.example.com/api/health   # {"status":"ok"}
docker compose -f deploy/compose.prod.yml $ENV logs --tail=50 baton caddy
```

## 8. First account, then invite-only

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

## 9. Check the backups

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

## 10. Restore drill

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

## 11. Upgrade

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

## 12. Rollback

```sh
cd /opt/baton && git checkout <previous-tag>
docker compose -f deploy/compose.prod.yml $ENV up -d --build
```

If the old image cannot run against the migrated schema (it will say so loudly in the
logs), restore the dump taken in step 11 into a fresh database and point `DATABASE_URL`
at it. Certificates, `postgres_data` and the environment file are untouched by both
directions.

## 13. Move to managed Postgres

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

## 14. Local smoke test (not production)

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

## 15. When something is wrong

- **No certificate.** `docker compose ... logs caddy`. Usually DNS is not resolving yet,
  or port 80/443 is blocked. Only 5 failed validations per domain per hour are allowed;
  wait it out rather than looping.
- **`dependency failed to start: container ... is unhealthy`.** The API logs the reason
  (`docker compose ... logs baton`). Missing `AUTH_SECRET` or `POSTGRES_PASSWORD`, or a
  database that is still starting.
- **Everything is slow or the kernel kills containers.** Check `free -m` and
  `docker stats`. Raise the Compose `deploy.resources.limits` or the VPS size, and lower
  `DATABASE_POOL_MAX` if the database refuses connections.
- **Disk filling up.** `docker image prune -f` after upgrades, and check
  `BACKUP_RETENTION_DAYS` is not excessive.
- **Everyone signs out at once.** `AUTH_SECRET` changed or was not set.
- **All rate limits trip at once.** `TRUSTED_PROXIES` no longer matches the `baton_net`
  subnet; the API then sees Caddy as every client. Fix the subnet in
  `deploy/compose.prod.yml` and the default in `deploy/.env.production` together.

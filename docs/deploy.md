# Deploy Baton

Baton runs as one container image on DigitalOcean App Platform with a Supabase Postgres.
The live app is `clownfish-app`:
https://clownfish-app-hng8v.ondigitalocean.app (`nyc`, `apps-s-1vcpu-1gb-fixed`, one
instance). Its service component is still named `nginx` from the placeholder the app was
created with; the name is cosmetic.

## How it works

- A push to `main` runs `.github/workflows/ci.yml`: lint and typecheck, then the docker job
  builds `Dockerfile.baton` for `linux/amd64` and pushes
  `ghcr.io/kabeerx9/baton:latest` and `ghcr.io/kabeerx9/baton:<commit sha>`.
- The GHCR package is public automatically because it belongs to the public repository.
  DigitalOcean is not linked to GitHub: App Platform only pulls the image.
- Deploys are manual: click **Deploy** in the app, or run
  `doctl apps create-deployment <app-id>`.
- The database is a free Supabase project in `us-east-1`. Use the **session pooler** on
  port `5432`, never the transaction pooler on `6543`, and end the URL with
  `?sslmode=no-verify` (`require` is treated as verify-full and fails on Supabase's CA).
- The API runs migrations when the container starts.

## First-time setup

1. **Supabase**: create a project in Americas (`us-east-1`). Open **Connect → Session
   pooler**, copy the URI, put the password in, and append `?sslmode=no-verify`.
2. **Keys**: `openssl rand -base64 32` twice, once for `AUTH_SECRET` and once for
   `NOTIFICATION_SECRET_ENCRYPTION_KEY`. Set them once and never change them.
3. **Create the app**: DigitalOcean dashboard → **Create → App Platform → Container
   image** → keep the `nginx:latest` Docker Hub placeholder. The dashboard's Git sources
   need a GitHub link, and `doctl apps create` needs a token with write access (ours was
   read-only and got a 403).
4. **Paste the spec**: **Settings → App Spec → Edit**. Start from `.do/app.yaml` and drop
   every optional env entry (the file lists them in a comment). The dashboard's
   `UpdateAppWithSpec` fails with a generic "authentication" error when a value is empty or
   when the app/component is renamed, so keep the placeholder names.
5. **Environment variables** on the component. Encrypt on: `DATABASE_URL`, `AUTH_SECRET`,
   `NOTIFICATION_SECRET_ENCRYPTION_KEY`, `SLACK_BOT_TOKEN`. Plain:
   `BATON_CLIENT_URL=${APP_URL}`, `BATON_CLOUD=true`,
   `TRUSTED_PROXIES=127.0.0.0/8,10.0.0.0/8`, `DATABASE_POOL_MAX=10`,
   `DISABLE_REGISTRATION=false` for the first signup (then `true`),
   `SLACK_DIGEST_TIME=10:00`, `SLACK_DIGEST_TZ=America/New_York`,
   `SENTRY_ENVIRONMENT=production`. Watch for typos; we once had `DATABSE_URL`.
6. **Health check**: HTTP `/api/health`.
7. **First account**: open the app URL and sign up; the first account becomes the instance
   admin. Then set `DISABLE_REGISTRATION=true`. Invited users can still join through invite
   links (no SMTP yet).

## Day to day

1. Push to `main` and wait for CI to go green.
2. Click **Deploy** in the app, or run `doctl apps create-deployment <app-id>`.
3. Watch the rollout: `doctl apps logs <app-id> --type run`.

## Rollback

Redeploy a previous deployment from the dashboard, or set the image tag to an older commit
sha and deploy. This does not work across a migration that drops tables or columns: an
older image reads what is gone. For those, restore the dump taken before the deploy (below).

## The auth-boundary deploy (once)

The image that holds all four auth-boundary phases runs `0005_auth_boundary_drops`. It
drops `invitation`, `team`, `team_member` and three `session` columns
(`active_organization_id`, `active_team_id`, `impersonated_by`). Users, passwords,
workspaces, members, roles, API keys, MCP grants and tasks stay. The full plan is
`records/auth-boundary.md` §6.

1. Stop using the app, the MCP and any API-key script. Pause agents with MCP grants.
2. Remove `SLACK_BOT_TOKEN` from the app (this redeploys the current image). A restore would
   send Slack messages again otherwise. If these are configured by then, also:
   - Email: remove `SMTP_HOST`. A restore would send emails again.
   - S3: no switch stops cleanup alone. Copy the bucket with the dump (step 4): cleanup
     deletes objects that a restore cannot bring back.
   - GitHub App: remove `GITHUB_WEBHOOK_SECRET` (the webhook route then refuses). GitHub
     does not redeliver by itself; redeliver the failed deliveries from the App's page in
     step 7.
3. Run `select count(*) from instance_webhook where enabled;`. If it is not 0, disable those
   webhooks in the admin settings.
4. Take the only recovery point: `pg_dump -Fc "$DATABASE_URL" > baton-before-auth-boundary.dump`
   (Supabase free has no backups). As a record, run
   `select workspace_id, count(*) from team group by 1 having count(*) > 1;`.
5. Deploy. Expect errors for up to the 180-second health-check delay while the old container
   still answers.
6. Check: sign in, open each workspace, check members and roles, call REST with an existing
   API key, connect the MCP. If sessions misbehave, `DELETE FROM session` is safe.
7. Put `SLACK_BOT_TOKEN` back and re-enable the webhooks. Put back `SMTP_HOST` and
   `GITHUB_WEBHOOK_SECRET` if you removed them, then redeliver the failed GitHub deliveries.

**Rollback:** keep the freeze, restore the dump with `pg_restore --clean --if-exists`,
deploy the previous image, then end the freeze. Every write after the dump is lost; that is
accepted while nobody uses the app.

## Not set up

SMTP, S3 image uploads, backups (Supabase free has none), custom domain.

## Open check

`do-connecting-ip` spoof test after a deploy: nginx forwards the header, so confirm
DigitalOcean overwrites a client-sent one.

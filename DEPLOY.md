# Deploying the tracker

Target: DigitalOcean App Platform. One app, one service, one Postgres database.
The spec is `.do/app.yaml`. Read [BOARD.md](BOARD.md) for what the app does.

## What runs

| Part | Detail |
| --- | --- |
| Service | The image from `Dockerfile.baton`: nginx serves the web app and passes `/api` to the API. Port 5173. |
| Database | Managed Postgres. The API runs its own migrations on every start. |
| Health check | `GET /api/health` |

Run one instance only. Live updates, events and scheduled jobs are held in the memory of
one process. To run more, add Redis and set `REDIS_URL` first.

## First deploy

1. Push the branch you want to deploy to `kabeerx9/baton`. The spec deploys `main`.
2. Create the app: `doctl apps create --spec .do/app.yaml`, or in the dashboard choose
   "Create App" and upload the spec.
3. Set `AUTH_SECRET` in the app's settings. Generate it with `openssl rand -hex 32`.
   Never change it later: it protects every login session.
4. Wait for the first deploy to turn healthy, then open the app URL.
5. Create your account, then create the workspace.
6. Invite each teammate by email on the Members page. They sign up with that same email
   and accept the invitation inside the app; no email server is needed for this.
7. Set `DISABLE_REGISTRATION` to `true` and redeploy, so nobody else can sign up.

## Slack messages (optional)

1. Create a Slack app with the bot scopes `chat:write` and `users:read.email`.
2. Install it to the workspace and copy the Bot User OAuth Token.
3. Set `SLACK_BOT_TOKEN` in the app's settings as a secret.
4. Call `POST /api/slack-dm/me/test` while signed in. The answer says what happened.

Each person must use the same email in the tracker and in Slack.

## Things that are not set up

- **File attachments.** The container disk is wiped on each deploy. Tasks and comments are
  in the database and are safe. To keep uploaded files, create a DigitalOcean Space and set
  the `S3_*` variables from `.env.sample`.
- **Email.** With no `SMTP_*` variables, invitation emails are not sent. Share the app URL
  with the team yourself, or set SMTP.
- **Custom domain.** Add it in the app's settings. `BATON_CLIENT_URL` follows `${APP_URL}`.

## Proven locally

On 2026-11-13 the image from `Dockerfile.baton` was built and run against an empty
Postgres database. It became healthy in about 8 seconds, ran all migrations, and a new
account could sign up, create a workspace, open the board and create a task.

## Not yet proven

These were not run against a real App Platform app:

- **Database TLS.** DigitalOcean's connection string ends in `sslmode=require` and its
  certificate comes from DigitalOcean's own CA. If the API fails at start with a
  certificate error, override `DATABASE_URL` in the dashboard with the same string ending in
  `sslmode=no-verify`, or attach the database's CA certificate.
- **Build size.** The image is built on App Platform from the Dockerfile. If the build runs
  out of memory, build it in GitHub Actions and deploy the image from a registry.
- **WebSockets** through App Platform's router. They are supported in general; live board
  updates fall back to a refresh on window focus if a socket cannot open.

## Later deploys

A push to the deployed branch builds and deploys by itself. Migrations run at start.
There is no automatic rollback of a migration: take a database backup before a deploy
that adds one.

Upgrading to migration 0077 (task change requests): stop every old API replica
before the new one starts. Old replicas do not check consent and do not bump
`task.status_generation`. The migration also rewrites every task row (it fills
`task.created_by`), so plan a short write pause on a large database.

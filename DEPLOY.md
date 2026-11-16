# Deploying Baton

The deployment guide is [docs/deploy.md](docs/deploy.md). It covers two paths:

- **One VPS.** Docker Compose runs Caddy, the Baton image and PostgreSQL, with
  backups to object storage. The files are in `deploy/`.
- **DigitalOcean App Platform.** The Baton image runs from the `.do/app.yaml`
  spec, and the database is Supabase PostgreSQL outside the spec.

Read [BOARD.md](BOARD.md) for what the app does.

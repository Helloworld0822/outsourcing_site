# Crewlink — Production Runbook

> Operational guide for taking Crewlink to a production environment. Pair
> this with the [README.md](README.md) at the repo root for the day-to-day
> dev workflow.

## 1. Architecture overview

```
   Internet
      │  :443 (HTTPS)
      ▼
   ┌──────────────────────────────────────────┐
   │  nginx  (TLS, rate limit, static files)  │
   │  - :80 → 301 → :443                       │
   │  - :443 serves SPA + reverse-proxies API  │
   └─────────────┬────────────────────────────┘
                 │ /api/*         /ws
                 ▼                ▼
   ┌──────────────────────────────────────────┐
   │  site_backend (Elixir release)            │
   │  - Plug.Cowboy on :4000 (HTTP API)        │
   │  - :cowboy on :4001 (WebSocket)           │
   │  - SiteBackend.Shutdown coordinates drain│
   └─────────────┬────────────────────────────┘
                 │
                 ▼
   ┌──────────────────────────────────────────┐
   │  PostgreSQL 15+ (managed: RDS / CloudSQL)│
   └──────────────────────────────────────────┘
```

## 2. Required environment

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` | ✅ | ≥ 32 bytes, random. `openssl rand -hex 32` |
| `SECRET_KEY_BASE` | ✅ | ≥ 32 bytes, random |
| `DB_PASSWORD` | ✅ | Strong, stored in secrets manager |
| `DB_NAME`, `DB_USER` | ✅ | Match Postgres role |
| `CORS_ALLOWED_ORIGINS` | ✅ | Comma-separated origin list |
| `DB_SSL` | ✅ in prod | Set `true` to require TLS to DB |
| `DB_CACERTFILE` | if `DB_SSL=true` | Path to CA bundle |
| `OPENAI_API_KEY` | optional | AI 추천 feature |
| `RESEND_API_KEY` | optional | 이메일 발송; 미설정 시 콘솔 출력 |
| `EMAIL_FROM` | recommended | Verified sender in Resend |
| `EMAIL_VERIFICATION_BASE_URL` | recommended | Public site origin |
| `SHUTDOWN_TIMEOUT` | optional | Default 30s |

The app refuses to start in `prod`/`staging` if `JWT_SECRET` or
`SECRET_KEY_BASE` is missing or weak.

## 3. Pre-deployment checklist

- [ ] Provision managed Postgres (RDS / Cloud SQL / Neon) with automated
      backups, point-in-time recovery, and TLS.
- [ ] Set up a managed secrets store (AWS Secrets Manager, GCP Secret
      Manager, Doppler, Vault). Do **not** commit `.env` to git.
- [ ] Provision a container registry (GHCR / ECR / GCR) and configure
      image scanning (Trivy / Snyk).
- [ ] Provision a managed Postgres connection with a CA cert; mount the
      cert into the backend container and set `DB_SSL=true`.
- [ ] Generate strong `JWT_SECRET` and `SECRET_KEY_BASE`. Store in the
      secrets manager and inject at runtime.
- [ ] Choose a domain. Issue a TLS cert (Let's Encrypt / managed). The
      nginx config terminates TLS on :443.
- [ ] Build the frontend: `cd outsourcing_site && npm ci && npm run build`.
      The `dist/` directory is mounted into the nginx container.
- [ ] Build the backend image: `docker build -t crewlink/backend:latest
      ./site_backend`.

## 4. First-time deploy

```bash
# 1. Apply migrations explicitly (idempotent and safe to re-run):
docker run --rm \
  -e MIX_ENV=prod \
  -e DB_NAME=... -e DB_USER=... -e DB_PASSWORD=... \
  -e DB_HOST=... -e DB_SSL=true -e DB_CACERTFILE=/etc/ssl/ca.pem \
  -v $PWD/site_backend/certs:/etc/ssl:ro \
  crewlink/backend:latest migrate

# 2. Bring up the stack:
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d

# 3. Verify health:
curl -fsS https://crewlink.io/healthz
curl -fsS https://api.crewlink.io/api/projects   # through nginx
```

## 5. Migrations

Migrations in `priv/repo/migrations/` are designed to be **idempotent**:
column additions use `ADD COLUMN IF NOT EXISTS`, table creations use
`CREATE TABLE IF NOT EXISTS`. This means:

- A fresh DB is built up by running the migrations on an empty schema.
- Re-running migrations on an already-migrated DB is a no-op ("Migrations
  already up").
- Order matters: migrations run top-to-bottom in version order. **Never
  edit a migration that has been applied to a real environment** —
  create a new one.

Run migrations from the release image:
```bash
docker run --rm ... crewlink/backend:latest migrate
```

## 6. Deploying a new release

```bash
# 1. Build and push the new image.
docker build -t ghcr.io/yourorg/crewlink-backend:$SHA ./site_backend
docker push ghcr.io/yourorg/crewlink-backend:$SHA

# 2. Update the running service with the new image.
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  pull backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --no-deps backend
```

The application honors `SIGTERM`: nginx stops sending new requests, the
backend's `SiteBackend.Shutdown` flips the drain flag, WebSocket
connections receive a `1001` close frame, in-flight requests get up to
`SHUTDOWN_TIMEOUT` ms to finish, then the BEAM exits.

If you deploy on Kubernetes, set:
```yaml
terminationGracePeriodSeconds: 60   # > SHUTDOWN_TIMEOUT/1000
lifecycle:
  preStop:
    exec:
      command: ["sleep", "5"]   # let ingress de-register the pod
```

## 7. Backups

- **DB**: rely on managed Postgres automated backups (daily snapshot + WAL
  archiving). Test restore quarterly.
- **Uploads**: `backend-uploads` is a Docker volume. Snapshot via
  `docker run --rm -v crewlink_backend-uploads:/data -v $PWD:/backup
  busybox tar czf /backup/uploads-$(date +%F).tgz /data` and ship to
  object storage (S3 / GCS).
- **Secrets**: secrets manager snapshot before any rotation drill.

## 8. Observability

- **Logs**: structured JSON in production. Ship to a log aggregator
  (Loki, Datadog, CloudWatch).
- **Metrics**: expose Prometheus metrics. Recommended libs:
  - `telemetry_metrics_prometheus_core`
  - `plug_cowboy` already emits telemetry; bind a reporter on `/metrics`.
- **Errors**: plug in Sentry via `sentry-elixir`. Capture uncaught
  exceptions and report with user/req context.
- **Alerts** (minimum):
  - HTTP 5xx rate > 1% over 5m
  - p99 latency > 1.5s over 5m
  - DB pool saturation > 80%
  - Cert expiring < 30d
  - Container memory > 80% of limit
  - Backup job failure

## 9. Security hardening

- The app refuses weak `JWT_SECRET` / `SECRET_KEY_BASE` in
  prod/staging.
- DB connections are TLS-encrypted when `DB_SSL=true`.
- nginx sets HSTS, X-Frame-Options, CSP, Referrer-Policy,
  Permissions-Policy.
- Login / signup / refresh / verify-email are rate-limited at the nginx
  layer (`limit_req_zone=auth`).
- API surface is rate-limited at `60 r/s` per IP.
- WebSocket connections are rate-limited at `5 r/s` per IP.
- All file uploads are validated by extension and size (≤ 5 MB), and
  served from a dedicated path under `/api/uploads/`.
- See `SECURITY.md` (TBD) for threat model + reporting instructions.

## 10. Rollback

```bash
# Roll back to the previous image tag.
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --no-deps -e IMAGE_TAG=$PREVIOUS_SHA backend
```

DB migrations are forward-only. If a migration needs to be reverted,
write a new migration that undoes the change and apply it.

## 11. Capacity planning (rough)

| Concurrent users | Backend replicas | DB pool/replica | Total DB pool |
|---|---|---|---|
| 100 | 2 | 20 | 40 |
| 1,000 | 4 | 30 | 120 |
| 10,000 | 8 | 50 | 400 |

Tune using telemetry: if pool wait time > 50 ms p99, scale up pool or
add replicas.

## 12. Common operations

- **Tail logs**: `docker compose -f docker-compose.prod.yml logs -f
  --tail=200 backend`
- **Attach to release**: `docker compose -f docker-compose.prod.yml exec
  backend /app/_release/bin/site_backend remote`
- **Run an ad-hoc Elixir script**: `docker compose -f
  docker-compose.prod.yml run --rm backend /app/_release/bin/site_backend
  eval 'IO.puts(:application.get_key(:site_backend, :vsn))'`
- **Rotate secrets**: update the secrets manager, then restart the
  backend with `docker compose ... up -d --no-deps --force-recreate
  backend`.

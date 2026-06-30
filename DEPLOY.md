# Crewlink — Deployment Guide

This guide covers the **production deployment** path that uses:

- **Vercel** for the React frontend (CDN, automatic preview deploys).
- **Fly.io** for the Elixir backend release (low-latency Elixir hosting,
  multi-region, $0–$5/mo to start).
- **Neon** for the managed serverless Postgres.

The repo's `docker-compose.yml` is the local-dev stack and
`docker-compose.prod.yml` is the on-prem prod alternative; this guide
covers the Vercel + Fly.io + Neon path.

For **Kubernetes**, see [`docs/K8S.md`](./docs/K8S.md) (cost profiles +
interactive apply via `scripts/k8s-cost-optimizer.sh`).

---

## 1. Prerequisites

- A GitHub account (or GitLab/Bitbucket) with the repo connected.
- Accounts on:
  - Vercel — https://vercel.com (free tier is enough to start)
  - Fly.io — https://fly.io (free allowance includes a shared CPU)
  - Neon — https://neon.tech (free tier: 0.5 GB)
- `flyctl` CLI: https://fly.io/docs/hands-on/install-flyctl/
- `vercel` CLI (optional, the dashboard works fine too):
  https://vercel.com/docs/cli

## 2. Database — Neon

1. Create a Neon project, region close to your Fly app.
2. Copy the **pooled** connection string. The URL has this shape:
   ```
   postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
   ```
3. Download the CA bundle:
   ```
   curl -O https://neon.tech/neon-ca-certs.pem
   ```
4. Place the file at `site_backend/neon-ca-certs.pem` (already covered
   by `[[files]]` in `fly.toml`).

> See [`docs/NEON.md`](./docs/NEON.md) for the detailed Neon guide.

## 3. Backend — Fly.io

```sh
# 1. Log in to Fly.io.
fly auth login

# 2. Create the app (one-time, idempotent).
cd site_backend
fly apps create crewlink-backend

# 3. Create a persistent volume for uploaded files.
fly volumes create backend_uploads --region nrt --size 1

# 4. Set the required secrets.
fly secrets set \
  DB_NAME=neondb \
  DB_USER=<neon-user> \
  DB_PASSWORD=<neon-password> \
  DB_HOST=<neon-host> \
  DB_PORT=5432 \
  DB_SSL=true \
  DB_CACERTFILE=/etc/ssl/neon-ca-certs.pem \
  JWT_SECRET="$(openssl rand -hex 32)" \
  SECRET_KEY_BASE="$(openssl rand -hex 32)" \
  CORS_ALLOWED_ORIGINS="https://crewlink.io,https://www.crewlink.io" \
  OPENAI_API_KEY=... \
  RESEND_API_KEY=... \
  EMAIL_FROM="Crewlink <no-reply@crewlink.io>" \
  EMAIL_VERIFICATION_BASE_URL="https://crewlink.io"

# 5. Deploy.
fly deploy
```

`fly.toml` runs `bin/site_backend migrate` as a `release_command` so the
DB schema is updated before the new release serves traffic.

### Custom domain

```sh
fly certs add api.crewlink.io
# Follow the DNS instructions Fly prints, then:
fly certs show api.crewlink.io
```

### Operational commands

```sh
fly status            # machine health
fly logs              # tail logs
fly ssh console       # interactive shell
fly releases          # list releases
fly releases rollback # revert
```

## 4. Frontend — Vercel

1. Import the repo on Vercel.
2. Set the **Root Directory** to `outsourcing_site`.
3. Vercel auto-detects Vite; the build command is `npm run build` and
   the output is `dist/`.
4. Add an environment variable:
   - `VITE_API_URL` = empty (we use Vercel rewrites to forward `/api/*`
     and `/ws` to Fly, so no cross-origin)
5. Deploy. Vercel gives you a `https://crewlink-xxxx.vercel.app`
   preview URL.
6. Add a custom domain (`crewlink.io`) under project settings.

### How the proxy works

`outsourcing_site/vercel.json` declares rewrites:

| Path | Destination |
|---|---|
| `/api/*` | `https://crewlink-backend.fly.dev/api/*` |
| `/ws` | `https://crewlink-backend.fly.dev/ws` |
| `/(.*)` | SPA fallback to `/index.html` |

All requests are served from the same origin, so the browser sends
cookies (when used) without CORS preflight, and WebSocket upgrades work
out of the box.

## 5. End-to-end smoke test

After both deploys finish:

```sh
# Frontend.
curl -fsS https://crewlink.io/

# API through Vercel.
curl -fsS https://crewlink.io/api/projects

# API directly (sanity).
curl -fsS https://crewlink-backend.fly.dev/projects

# WebSocket (use any ws client, e.g. websocat).
websocat wss://crewlink.io/ws
```

## 6. Continuous deployment

### Backend

- Connect the GitHub repo to Fly: `fly deploy --strategy canary` in CI.
- Or use the Fly GitHub Actions integration:
  https://github.com/superfly/flyctl-actions

### Frontend

- Vercel auto-deploys on push to `main` (production) and on PRs
  (preview).
- Preview URLs are useful for QA: each PR gets its own
  `crewlink-git-<branch>-<org>.vercel.app` URL.

## 7. Cost

| Service | Free allowance | Likely cost at 1k MAU |
|---|---|---|
| Vercel | 100 GB bandwidth, 100k serverless invocations | $0–20/mo |
| Fly.io | 3 shared CPU machines, 3 GB volume, 160 GB outbound | $0–10/mo |
| Neon | 0.5 GB storage, 191 compute hours | $0–19/mo |

The whole stack can run for **$0/mo** at low traffic and stays under
**$50/mo** at moderate scale.

## 8. Rollback

```sh
# Backend – list recent releases, then:
fly releases
fly releases rollback vN

# Frontend – in Vercel dashboard, promote a previous deployment.
```

## 9. Local development

`docker compose up` from the repo root still works and is the
recommended local workflow. The Vercel + Fly.io setup only differs in
where the data plane lives.

```sh
docker compose up -d
open http://localhost:82
```

For pointing the local frontend at a deployed backend, set
`VITE_API_URL=https://crewlink-backend.fly.dev` in
`outsourcing_site/.env.local` and run `npm run dev` from
`outsourcing_site/`.

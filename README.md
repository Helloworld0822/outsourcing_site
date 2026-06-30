# Crewlink

AI-powered 외주 중개 플랫폼 (크몽/Kakao Style) — React frontend + Elixir
backend + Postgres.

- **Frontend** (`outsourcing_site/`) — React 19 + Vite + TypeScript + Tailwind v4
- **Backend** (`site_backend/`) — Elixir/OTP + Plug.Cowboy + Ecto + Postgres
- **WebSocket** — in-process Cowboy listener for chat & real-time notifications

## Quick start (local)

```sh
cp .env.example .env       # edit values if you need to
docker compose up -d
open http://localhost:82
```

Services started:

| Service | URL | Notes |
|---|---|---|
| nginx (entrypoint) | http://localhost:82 | SPA + reverse proxy |
| Frontend (Vite) | http://localhost:5173 | internal, HMR enabled |
| Backend (HTTP) | http://localhost:4000 | internal |
| Backend (WS) | ws://localhost:4001 | internal |
| Postgres | localhost:5432 | internal, `postgres/postgres` |

## Layout

```
.
├── docker-compose.yml          # dev stack (db, backend, vite, nginx)
├── docker-compose.prod.yml     # on-prem prod override
├── nginx/
│   ├── default.conf            # dev nginx config
│   ├── default.prod.conf       # prod nginx config (TLS, rate limits)
│   └── nginx.prod.conf         # prod main nginx.conf
├── outsourcing_site/           # React frontend
│   ├── Dockerfile.dev
│   ├── vercel.json             # Vercel rewrites /api + /ws → fly.io
│   └── src/
├── site_backend/               # Elixir backend
│   ├── Dockerfile              # multi-stage prod release
│   ├── Dockerfile.dev
│   ├── fly.toml                # Fly.io deployment manifest
│   └── lib/
├── fly.toml                    # Fly.io root-level manifest (alternative)
├── .env.example
├── PRODUCTION.md               # on-prem prod runbook
├── DEPLOY.md                   # Vercel + Fly.io + Neon deploy guide
└── docs/NEON.md                # Neon setup
```

## Documentation

- [DEPLOY.md](./DEPLOY.md) — Vercel + Fly.io + Neon (recommended for
  hosting)
- [PRODUCTION.md](./PRODUCTION.md) — On-prem / self-hosted via
  docker-compose
- [docs/NEON.md](./docs/NEON.md) — Neon Postgres setup details
- [site_backend/README.md](./site_backend/README.md) — Backend module
  overview
- [outsourcing_site/README.md](./outsourcing_site/README.md) — Frontend
  module overview

## Tech highlights

- **Graceful shutdown** — `SiteBackend.Shutdown` GenServer coordinates
  drain on SIGTERM/SIGINT: in-flight requests get up to
  `SHUTDOWN_TIMEOUT` (default 30s) to finish, WebSocket connections
  receive a `1001` close frame with payload.
- **Idempotent migrations** — every column-add migration uses
  `ADD COLUMN IF NOT EXISTS` so the same migration can run against
  fresh or pre-initialized databases.
- **Idempotent env-driven config** — DB pool size, SSL, and log level
  come from environment variables; the app refuses to boot in
  prod/staging with default secrets.
- **Email verification enforced** on user-generated content routes
  (uploads, project/service creation, applications, chat writes).
- **Rate limiting** at the nginx layer (auth, api, ws) and at the
  application layer (login, signup, refresh).

## Deployment

| Path | Doc |
|------|-----|
| Vercel + Fly.io + Neon | [DEPLOY.md](./DEPLOY.md) |
| **Kubernetes** | [docs/K8S.md](./docs/K8S.md) |

Kubernetes 배포 시 비용 최소화 기획을 먼저 검토하고, 실행 여부를 직접 선택할 수 있습니다:

```sh
cp k8s/base/secret.example.yaml k8s/base/secret.yaml  # 값 입력
./scripts/k8s-cost-optimizer.sh --plan-only            # 기획만
./scripts/k8s-cost-optimizer.sh                        # y/N 확인 후 적용
```

## License

Proprietary. © 2026 Crewlink. All rights reserved.

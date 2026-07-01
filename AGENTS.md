# AGENTS.md

## Cursor Cloud specific instructions

Crewlink is a freelance/outsourcing marketplace: an **Elixir (Plug/Cowboy)** backend (`site_backend/`, HTTP :4000 + WebSocket :4001, Postgres, optional Redis) and a **React + Vite** frontend (`outsourcing_site/`). See README/DESIGN.md for product context; standard commands are in `site_backend/mix.exs` and `outsourcing_site/package.json`.

The Cloud Agent VM already has Elixir 1.18.4/OTP 27, Node 22, PostgreSQL 16, Redis, and nginx installed. The update script refreshes `mix deps.get` and the frontend node_modules. It does **not** start services.

### Running the app (dev)
- Start infra once per session: `sudo service postgresql start` and `sudo service redis-server start`.
- Backend needs these env vars (dev defaults are fine): `DB_HOST=localhost DB_USER=postgres DB_PASSWORD=postgres DB_NAME=outsourcing_dev DB_PORT=5432 REDIS_URL=redis://localhost:6379/0 JWT_SECRET=dev_jwt_secret SECRET_KEY_BASE=dev_secret PORT=4000 WS_PORT=4001`. Run: `cd site_backend && mix run --no-halt`.
- Frontend: `cd outsourcing_site && npm run dev -- --host 0.0.0.0 --port 5373 --strictPort` (its config pins :5173, overridden here to **:5373** because DayFlow uses 5173).
- Access the full app through nginx at **http://localhost:82** (`sudo service nginx start`; config `/etc/nginx/sites-available/crewlink-dev.conf`).
- Checks: frontend `npm run build` (passes) and `npm run lint` (has pre-existing errors); backend `mix compile`, and `mix test` with `MIX_ENV=test PORT=4100 WS_PORT=4101` (alt ports so it doesn't clash with the running dev server).

### Non-obvious caveats
- **Database bootstrap:** the Ecto migrations are written to layer on top of `init.sql` (the repo-root baseline that the Docker/postgres entrypoint applies first). Columns like `users.interests/birth_date/gender` exist **only** in `init.sql`, never in migrations. For a native/local Postgres you must apply `init.sql` **before** `mix ecto.migrate`, e.g. `psql -f init.sql <db>` then migrate. This DB (`outsourcing_dev`) is already bootstrapped in the snapshot.
- The frontend calls same-origin `/api/...` (and WS `/ws`); nginx strips `/api` and routes `/ws`→:4001. Go through nginx (:82), not Vite directly.
- Signup requires email verification before login. With no `RESEND_API_KEY`, the verification link is only logged; the token can be read from `users.email_verification_token`, then `GET /api/verify-email/:token`.
- `mix compile --warnings-as-errors` fails on pre-existing warnings (`worker.ex`, `cache.ex`); plain `mix compile` is clean and the app runs fine.
- Redis is optional (the cache fails open); OpenAI/Resend are optional.

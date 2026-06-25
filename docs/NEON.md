# Neon Postgres setup for Crewlink

## 1. Create a Neon project

1. Sign up at https://neon.tech.
2. Create a new project (region: AWS US East 2 or Tokyo for low latency from `nrt`).
3. Copy the **pooled** connection string from the Neon dashboard:
   ```
   postgresql://<user>:<password>@<host>.neon.tech/neondb?sslmode=require
   ```
4. Download the Neon CA bundle:
   ```
   curl -O https://neon.tech/neon-ca-certs.pem
   ```

## 2. Configure the backend

When running on Fly.io:

```sh
fly secrets set \
  DB_NAME=neondb \
  DB_USER=<user> \
  DB_PASSWORD=<password> \
  DB_HOST=<host>.neon.tech \
  DB_PORT=5432 \
  DB_SSL=true \
  DB_CACERTFILE=/etc/ssl/neon-ca-certs.pem
```

Mount the CA bundle into the container by adding a `[[files]]` entry to
`fly.toml`:

```toml
[[files]]
  source = "neon-ca-certs.pem"
  destination = "/etc/ssl/neon-ca-certs.pem"
```

## 3. Run migrations

On the first deploy, `fly.toml` declares a `release_command` that runs
`bin/site_backend migrate`. Subsequent deploys will detect "Migrations
already up" and proceed.

If you need to run migrations manually (e.g. from CI):

```sh
fly ssh console -C "/app/_release/bin/site_backend migrate"
```

## 4. Branching workflow (optional)

Neon supports database branches per PR. To wire it up in CI:

1. In the Neon dashboard, create a branch per PR.
2. Capture the new branch's connection string.
3. In your CI step, set `DB_HOST`, `DB_PASSWORD`, etc. for the branch.
4. Run the integration test suite against that DB, then drop the branch.

## 5. Local development

Use the dev docker-compose stack with a local Postgres container (the
default `db` service). Do **not** point development at the production
Neon database.

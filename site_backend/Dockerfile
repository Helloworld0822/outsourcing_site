FROM elixir:latest

# install build deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg build-essential git libpq-dev postgresql-client openssl \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g yarn \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY mix.exs mix.lock ./
COPY config ./config

RUN mix local.hex --force && mix local.rebar --force
RUN mix deps.get --only prod

COPY . .

RUN mix compile

EXPOSE 4000

CMD ["sh", "-c", "until pg_isready -h \"$DB_HOST\" -p \"$DB_PORT\" -U \"$DB_USER\"; do echo 'waiting for postgres'; sleep 2; done; MIX_ENV=prod mix ecto.create && MIX_ENV=prod mix ecto.migrate && MIX_ENV=prod mix run --no-halt"]

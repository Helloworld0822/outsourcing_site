# syntax=docker/dockerfile:1.7

# ─── Stage 1: build the Elixir release ────────────────────────────────
ARG ELIXIR_VERSION=1.18.4
ARG OTP_VERSION=27.3.4
ARG DEBIAN_VERSION=bookworm-20250428

ARG BUILDER_IMAGE="hexpm/elixir:${ELIXIR_VERSION}-erlang-${OTP_VERSION}-debian-${DEBIAN_VERSION}"
ARG RUNNER_IMAGE="debian:${DEBIAN_VERSION}-slim"

FROM ${BUILDER_IMAGE} AS builder

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    MIX_ENV=prod

# Build dependencies for bcrypt + libsodium-style nifs.
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    git \
    libpq-dev \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Fetch deps in their own layer so source changes don't bust the cache.
RUN mix local.hex --force && mix local.rebar --force
COPY mix.exs mix.lock ./
COPY config ./config
RUN mix deps.get --only $MIX_ENV
RUN mkdir config

# Build the release.
COPY lib ./lib
COPY priv ./priv
RUN mix deps.compile --only $MIX_ENV
RUN mix release --path /app/_release

# ─── Stage 2: minimal runtime image ────────────────────────────────────
FROM ${RUNNER_IMAGE} AS runner

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    MIX_ENV=prod \
    HOME=/app

# Runtime dependencies: postgres client (for psql-based ops) + tzdata.
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libpq5 \
    openssl \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Non-root runtime user.
RUN groupadd --system --gid 1000 crewlink && \
    useradd --system --uid 1000 --gid crewlink --home /app --shell /sbin/nologin crewlink

WORKDIR /app

# Copy the built release from the builder stage.
COPY --from=builder --chown=crewlink:crewlink /app/_release /app/_release
COPY --from=builder --chown=crewlink:crewlink /app/priv /app/priv
COPY --from=builder --chown=crewlink:crewlink /app/config /app/config
COPY --from=builder --chown=crewlink:crewlink /app/mix.exs /app/mix.exs
COPY --from=builder --chown=crewlink:crewlink /app/mix.lock /app/mix.lock

# Persist uploaded files outside the release image.
RUN mkdir -p /app/priv/static/uploads && chown -R crewlink:crewlink /app/priv/static/uploads

USER crewlink

EXPOSE 4000 4001

# Health check via a tiny HTTP probe against the same port the app binds.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:4000/api/projects || exit 1

# Default to foreground; operators can run `bin/site_backend migrate` to
# apply DB migrations before starting the app.
ENTRYPOINT ["/app/_release/bin/site_backend"]
CMD ["start"]

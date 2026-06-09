import Config

config :site_backend, ecto_repos: [SiteBackend.Repo]

config :joken, signer: [alg: "HS256", key: System.get_env("JWT_SECRET") || "dev_jwt_secret"]

config :logger, level: :info

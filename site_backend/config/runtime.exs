import Config

env = System.get_env("MIX_ENV") || "dev"
is_prod_like = env in ["prod", "staging"]

# SSL/TLS to the database: opt in per environment via DB_SSL=true.
# Operators should also provide DB_CACERTFILE for verify_peer mode.
db_ssl = System.get_env("DB_SSL", "false") == "true"

# SQL log level for Ecto. Defaults to silent (:warning) everywhere; override
# per env via DB_LOG_LEVEL=false|:info|:debug.
db_log_level =
  case System.get_env("DB_LOG_LEVEL") do
    nil -> false
    "" -> false
    "false" -> false
    "true" -> :debug
    "info" -> :info
    "debug" -> :debug
    "warning" -> :warning
    level -> String.to_existing_atom(level)
  end

base_repo_config = [
  database: System.get_env("DB_NAME") || "outsourcing_dev",
  username: System.get_env("DB_USER") || "postgres",
  password: System.get_env("DB_PASSWORD") || "postgres",
  hostname: System.get_env("DB_HOST") || "localhost",
  port: String.to_integer(System.get_env("DB_PORT") || "5432"),
  pool_size: String.to_integer(System.get_env("DB_POOL_SIZE") || "10"),
  ssl: db_ssl,
  log: db_log_level
]

repo_config =
  if db_ssl do
    Keyword.put(base_repo_config, :ssl_opts, [
      verify: :verify_peer,
      cacertfile: System.get_env("DB_CACERTFILE"),
      server_name_indication: String.to_charlist(System.get_env("DB_HOST") || "localhost"),
      versions: [:"tlsv1.2", :"tlsv1.3"]
    ])
  else
    base_repo_config
  end

config :site_backend, SiteBackend.Repo, repo_config

# In dev, fall back to a deterministic value so the app boots. In prod/staging
# we require the operator to set SECRET_KEY_BASE explicitly; the application
# start will refuse to boot with the dev default.
secret_key_base =
  System.get_env("SECRET_KEY_BASE") ||
    if(is_prod_like, do: raise("SECRET_KEY_BASE is required in #{env}"), else: "dev_secret")

config :site_backend, secret_key_base: secret_key_base

config :site_backend, :email_verification,
  base_url: System.get_env("EMAIL_VERIFICATION_BASE_URL") || "http://localhost:5173"

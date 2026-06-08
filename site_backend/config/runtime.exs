import Config

repo_config = [
  database: System.get_env("DB_NAME") || "outsourcing_dev",
  username: System.get_env("DB_USER") || "postgres",
  password: System.get_env("DB_PASSWORD") || "postgres",
  hostname: System.get_env("DB_HOST") || "localhost",
  port: String.to_integer(System.get_env("DB_PORT") || "5432"),
  pool_size: 10
]

config :site_backend, SiteBackend.Repo, repo_config

config :site_backend,
  secret_key_base: System.get_env("SECRET_KEY_BASE") || "dev_secret"

config :site_backend, :email_verification,
  base_url: System.get_env("EMAIL_VERIFICATION_BASE_URL") || "http://localhost:5173"

if smtp_host = System.get_env("SMTP_HOST") do
  config :site_backend, SiteBackend.Mailer,
    adapter: Swoosh.Adapters.SMTP,
    hostname: smtp_host,
    port: String.to_integer(System.get_env("SMTP_PORT") || "587"),
    username: System.get_env("SMTP_USERNAME"),
    password: System.get_env("SMTP_PASSWORD"),
    tls: :always,
    ssl: false,
    retries: 1,
    no_mx_lookup: false
end

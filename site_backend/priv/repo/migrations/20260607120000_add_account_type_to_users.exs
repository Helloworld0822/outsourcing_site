defmodule SiteBackend.Repo.Migrations.AddAccountTypeToUsers do
  use Ecto.Migration

  # init.sql (mounted at /docker-entrypoint-initdb.d) may have already
  # created the `users` table with an `account_type` column on a fresh
  # volume, so this migration must be idempotent.
  def change do
    execute("""
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS account_type varchar NOT NULL DEFAULT 'client'
    """)
  end
end

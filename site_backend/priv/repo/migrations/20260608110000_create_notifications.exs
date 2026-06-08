defmodule SiteBackend.Repo.Migrations.CreateNotifications do
  use Ecto.Migration

  def change do
    execute "CREATE EXTENSION IF NOT EXISTS pgcrypto"

    execute """
    CREATE TABLE IF NOT EXISTS notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title text NOT NULL,
      message text NOT NULL,
      type text NOT NULL,
      ref_id uuid,
      is_read boolean NOT NULL DEFAULT false,
      inserted_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
    """

    execute "CREATE INDEX IF NOT EXISTS notifications_user_id_index ON notifications (user_id)"
    execute "CREATE INDEX IF NOT EXISTS notifications_is_read_index ON notifications (is_read)"
  end
end

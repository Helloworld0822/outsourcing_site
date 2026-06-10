defmodule SiteBackend.Repo.Migrations.CreateUserProfiles do
  use Ecto.Migration

  def change do
    execute("""
    CREATE TABLE IF NOT EXISTS user_profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bio text,
      avatar_url text,
      location text,
      website_url text,
      github_url text,
      skills text[] NOT NULL DEFAULT ARRAY[]::text[],
      hourly_rate text,
      experience_years integer,
      portfolio_items jsonb NOT NULL DEFAULT '[]'::jsonb,
      is_public boolean NOT NULL DEFAULT true,
      inserted_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
    """)

    execute("CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_user_id_index ON user_profiles (user_id)")
    execute("CREATE INDEX IF NOT EXISTS user_profiles_is_public_index ON user_profiles (is_public)")
  end
end

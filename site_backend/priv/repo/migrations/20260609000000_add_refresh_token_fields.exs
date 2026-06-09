defmodule SiteBackend.Repo.Migrations.AddRefreshTokenFields do
  use Ecto.Migration

  def up do
    alter table(:users) do
      add :refresh_token_hash, :string
      add :refresh_token_expires_at, :naive_datetime
    end

    create unique_index(:users, [:refresh_token_hash], where: "refresh_token_hash IS NOT NULL")
  end

  def down do
    drop_if_exists index(:users, [:refresh_token_hash])

    alter table(:users) do
      remove :refresh_token_hash
      remove :refresh_token_expires_at
    end
  end
end

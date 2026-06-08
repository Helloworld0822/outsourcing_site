defmodule SiteBackend.Repo.Migrations.AddEmailVerificationFields do
  use Ecto.Migration

  def up do
    alter table(:users) do
      add :email_verified, :boolean, default: false, null: false
      add :email_verification_token, :string
      add :email_verification_sent_at, :naive_datetime
    end

    create unique_index(:users, [:email_verification_token], where: "email_verification_token IS NOT NULL")
  end

  def down do
    drop_if_exists index(:users, [:email_verification_token])

    alter table(:users) do
      remove :email_verified
      remove :email_verification_token
      remove :email_verification_sent_at
    end
  end
end

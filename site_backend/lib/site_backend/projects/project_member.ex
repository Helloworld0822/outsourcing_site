defmodule SiteBackend.ProjectMember do
  use Ecto.Schema
  import Ecto.Changeset

  alias SiteBackend.{Project, ProjectApplication, User}

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "project_members" do
    field :role, :string
    field :joined_at, :naive_datetime

    belongs_to :project, Project, type: :binary_id
    belongs_to :user, User, type: :binary_id
    belongs_to :application, ProjectApplication, type: :binary_id

    timestamps()
  end

  def changeset(member, params) do
    member
    |> cast(params, [:project_id, :user_id, :role, :application_id, :joined_at])
    |> validate_required([:project_id, :user_id, :role])
    |> unique_constraint([:project_id, :user_id])
    |> foreign_key_constraint(:project_id)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:application_id)
  end
end

defmodule SiteBackend.ProjectApplication do
  use Ecto.Schema
  import Ecto.Changeset

  alias SiteBackend.{Project, User}

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "project_applications" do
    field :message, :string
    field :proposed_role, :string
    field :source, Ecto.Enum, values: [:apply, :invite], default: :apply
    field :status, Ecto.Enum, values: [:pending, :accepted, :rejected], default: :pending
    belongs_to :project, Project, type: :binary_id
    belongs_to :freelancer, User, type: :binary_id

    timestamps()
  end

  def changeset(application, params) do
    application
    |> cast(params, [:project_id, :freelancer_id, :message, :status, :proposed_role, :source])
    |> validate_required([:project_id, :freelancer_id, :message])
    |> unique_constraint(:project_id, name: :project_applications_project_id_freelancer_id_index)
    |> foreign_key_constraint(:project_id)
    |> foreign_key_constraint(:freelancer_id)
  end
end

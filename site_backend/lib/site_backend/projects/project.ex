defmodule SiteBackend.Project do
  use Ecto.Schema
  import Ecto.Changeset

  alias SiteBackend.{ChatRoom, ProjectApplication, ProjectMember, User}

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "projects" do
    field :title, :string
    field :description, :string
    field :skills, {:array, :string}, default: []
    field :budget, :string
    field :client_name, :string
    field :status, Ecto.Enum, values: [:recruiting, :in_progress, :completed, :closed], default: :recruiting
    belongs_to :client, User, type: :binary_id
    belongs_to :group_chat_room, ChatRoom, type: :binary_id
    has_many :applications, ProjectApplication
    has_many :members, ProjectMember

    timestamps()
  end

  def changeset(project, params) do
    project
    |> cast(params, [:title, :description, :skills, :budget, :client_name, :client_id, :status, :group_chat_room_id])
    |> validate_required([:title, :client_id])
  end
end

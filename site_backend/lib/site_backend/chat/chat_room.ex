defmodule SiteBackend.ChatRoom do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  @timestamps_opts [type: :naive_datetime]

  schema "chat_rooms" do
    field :room_type, Ecto.Enum, values: [:direct, :group], default: :direct
    field :name, :string

    belongs_to :client, SiteBackend.User, type: :binary_id
    belongs_to :freelancer, SiteBackend.User, type: :binary_id
    belongs_to :service_order, SiteBackend.ServiceOrder, type: :binary_id
    belongs_to :project, SiteBackend.Project, type: :binary_id

    has_many :messages, SiteBackend.ChatMessage, foreign_key: :chat_room_id
    has_many :participants, SiteBackend.ChatRoomParticipant, foreign_key: :chat_room_id

    timestamps()
  end

  def changeset(chat_room, attrs) do
    chat_room
    |> cast(attrs, [:client_id, :freelancer_id, :service_order_id, :room_type, :project_id, :name])
    |> validate_room_type()
  end

  defp validate_room_type(changeset) do
    case get_field(changeset, :room_type) do
      :group ->
        changeset
        |> validate_required([:name, :project_id])

      _ ->
        changeset
        |> validate_required([:client_id, :freelancer_id])
    end
  end
end

defmodule SiteBackend.ChatRoomParticipant do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  @timestamps_opts [type: :naive_datetime]

  schema "chat_room_participants" do
    belongs_to :chat_room, SiteBackend.ChatRoom
    belongs_to :user, SiteBackend.User

    timestamps()
  end

  def changeset(participant, attrs) do
    participant
    |> cast(attrs, [:chat_room_id, :user_id])
    |> validate_required([:chat_room_id, :user_id])
    |> unique_constraint([:chat_room_id, :user_id])
    |> foreign_key_constraint(:chat_room_id)
    |> foreign_key_constraint(:user_id)
  end
end

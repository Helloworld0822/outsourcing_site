defmodule SiteBackend.Chat do
  @moduledoc """
  채팅 관리 컨텍스트.
  """

  import Ecto.Query
  alias SiteBackend.Repo
  alias SiteBackend.ChatRoom
  alias SiteBackend.ChatMessage
  alias SiteBackend.User

  def get_or_create_room(user_id, freelancer_id, service_order_id \\ nil) do
    user = Repo.get(User, user_id)

    {client_id, freelancer_id} =
      if user && user.account_type == :freelancer,
        do: {freelancer_id, user_id},
        else: {user_id, freelancer_id}

    existing =
      from(r in ChatRoom,
        where: r.client_id == ^client_id and r.freelancer_id == ^freelancer_id
      )
      |> Repo.one()
      |> Repo.preload([:client, :freelancer])

    if existing do
      {:ok, chat_room_to_map(existing)}
    else
      params = %{client_id: client_id, freelancer_id: freelancer_id}
      params = if service_order_id, do: Map.put(params, :service_order_id, service_order_id), else: params

      case ChatRoom.changeset(%ChatRoom{}, params) |> Repo.insert() do
        {:ok, room} ->
          room = Repo.preload(room, [:client, :freelancer])
          {:ok, chat_room_to_map(room)}

        {:error, changeset} ->
          {:error, changeset}
      end
    end
  end

  def list_rooms(user_id, user_type) do
    field = if user_type == :client, do: :client_id, else: :freelancer_id
    rooms =
      from(r in ChatRoom, where: field(r, ^field) == ^user_id, order_by: [desc: r.updated_at])
      |> Repo.all()
      |> Repo.preload([:client, :freelancer, :service_order])

    Enum.map(rooms, &chat_room_to_map/1)
  end

  def list_messages(user_id, room_id) do
    case Repo.get(ChatRoom, room_id) do
      nil -> {:error, :not_found}
      %ChatRoom{} = room -> authorize_and(user_id, room, fn r -> {:ok, load_messages(r)} end)
    end
  end

  def send_message(user_id, room_id, content) do
    case Repo.get(ChatRoom, room_id) do
      nil -> {:error, :not_found}
      %ChatRoom{} = room -> authorize_and(user_id, room, fn r -> do_send_message(r, user_id, content) end)
    end
  end

  defp authorize_and(user_id, room, ok_fun) do
    if room.client_id == user_id or room.freelancer_id == user_id do
      ok_fun.(room)
    else
      {:error, :forbidden}
    end
  end

  defp load_messages(room) do
    room.id
    |> fetch_messages_query()
    |> Repo.all()
    |> Repo.preload(:sender)
    |> Enum.map(&chat_message_to_map/1)
  end

  defp fetch_messages_query(room_id) do
    from m in ChatMessage,
      where: m.chat_room_id == ^room_id,
      order_by: [asc: m.inserted_at],
      limit: 100
  end

  def chat_room_to_map(room) do
    %{
      id: room.id,
      client_id: room.client_id,
      freelancer_id: room.freelancer_id,
      service_order_id: room.service_order_id,
      client: if(room.client, do: user_to_map(room.client), else: nil),
      freelancer: if(room.freelancer, do: user_to_map(room.freelancer), else: nil),
      inserted_at: format_datetime(room.inserted_at),
      updated_at: format_datetime(room.updated_at)
    }
  end

  def chat_message_to_map(message) do
    %{
      id: message.id,
      chat_room_id: message.chat_room_id,
      sender_id: message.sender_id,
      content: message.content,
      sender: if(message.sender, do: user_to_map(message.sender), else: nil),
      inserted_at: format_datetime(message.inserted_at),
      updated_at: format_datetime(message.updated_at)
    }
  end

  defp do_send_message(room, user_id, content) do
    params = %{
      content: content,
      chat_room_id: room.id,
      sender_id: user_id
    }

    case ChatMessage.changeset(%ChatMessage{}, params) |> Repo.insert() do
      {:ok, message} ->
        message = Repo.preload(message, :sender)
        msg_map = chat_message_to_map(message)

        SiteBackend.PubSub.broadcast(room.client_id, %{type: "chat", data: msg_map})
        SiteBackend.PubSub.broadcast(room.freelancer_id, %{type: "chat", data: msg_map})

        {:ok, msg_map}

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  defp user_to_map(user) do
    %{
      id: user.id,
      email: user.email,
      name: user.name,
      account_type: Atom.to_string(user.account_type)
    }
  end

  defp format_datetime(nil), do: nil
  defp format_datetime(datetime), do: NaiveDateTime.to_iso8601(datetime)
end

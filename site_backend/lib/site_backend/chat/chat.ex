defmodule SiteBackend.Chat do
  @moduledoc """
  채팅 관리 컨텍스트.
  """

  import Ecto.Query
  alias Ecto.Multi
  alias SiteBackend.Repo
  alias SiteBackend.ChatRoom
  alias SiteBackend.ChatMessage
  alias SiteBackend.ChatRoomParticipant
  alias SiteBackend.Project
  alias SiteBackend.ProjectMember
  alias SiteBackend.User

  def get_or_create_room(user_id, freelancer_id, service_order_id \\ nil) do
    user = Repo.get(User, user_id)

    {client_id, freelancer_id} =
      if user && user.account_type == :freelancer,
        do: {freelancer_id, user_id},
        else: {user_id, freelancer_id}

    existing =
      from(r in ChatRoom,
        where:
          r.room_type == ^:direct and r.client_id == ^client_id and r.freelancer_id == ^freelancer_id
      )
      |> Repo.one()
      |> preload_room()

    if existing do
      {:ok, chat_room_to_map(existing)}
    else
      params = %{
        client_id: client_id,
        freelancer_id: freelancer_id,
        room_type: :direct
      }

      params = if service_order_id, do: Map.put(params, :service_order_id, service_order_id), else: params

      case ChatRoom.changeset(%ChatRoom{}, params) |> Repo.insert() do
        {:ok, room} ->
          {:ok, chat_room_to_map(preload_room(room))}

        {:error, changeset} ->
          {:error, changeset}
      end
    end
  end

  def get_project_group_room(project_id, user_id) do
    with {:ok, _} <- authorize_project_access(project_id, user_id),
         room when not is_nil(room) <- get_group_room_by_project(project_id) do
      {:ok, chat_room_to_map(preload_room(room))}
    else
      nil -> {:error, :not_found}
      {:error, _} = err -> err
    end
  end

  def ensure_project_group_room(%Project{} = project, new_user_id) do
    room =
      from(r in ChatRoom, where: r.room_type == ^:group and r.project_id == ^project.id)
      |> Repo.one()

    participant_ids = collect_project_participant_ids(project, new_user_id)

    if room do
      add_participants(room, participant_ids)
      link_project_group_chat(project, room)
      {:ok, preload_room(room)}
    else
      create_project_group_room(project, participant_ids)
    end
  end

  defp link_project_group_chat(project, room) do
    if project.group_chat_room_id != room.id do
      project
      |> Project.changeset(%{group_chat_room_id: room.id, status: :in_progress})
      |> Repo.update()
    end

    :ok
  end

  defp create_project_group_room(project, participant_ids) do
    Multi.new()
    |> Multi.insert(:room, fn _ ->
      ChatRoom.changeset(%ChatRoom{}, %{
        room_type: :group,
        project_id: project.id,
        name: "#{project.title} 팀"
      })
    end)
    |> Multi.run(:participants, fn repo, %{room: room} ->
      insert_participants(repo, room.id, participant_ids)
      {:ok, :done}
    end)
    |> Multi.update(:project, fn %{room: room} ->
      Project.changeset(project, %{group_chat_room_id: room.id, status: :in_progress})
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{room: room}} -> {:ok, preload_room(room)}
      {:error, _step, reason, _} -> {:error, reason}
    end
  end

  defp add_participants(room, user_ids) do
    Enum.each(user_ids, fn uid ->
      %ChatRoomParticipant{}
      |> ChatRoomParticipant.changeset(%{chat_room_id: room.id, user_id: uid})
      |> Repo.insert(on_conflict: :nothing, conflict_target: [:chat_room_id, :user_id])
    end)

    :ok
  end

  defp insert_participants(repo, room_id, user_ids) do
    Enum.each(Enum.uniq(user_ids), fn uid ->
      repo.insert(
        ChatRoomParticipant.changeset(%ChatRoomParticipant{}, %{
          chat_room_id: room_id,
          user_id: uid
        }),
        on_conflict: :nothing,
        conflict_target: [:chat_room_id, :user_id]
      )
    end)
  end

  defp collect_project_participant_ids(project, new_user_id) do
    member_ids =
      from(m in ProjectMember, where: m.project_id == ^project.id, select: m.user_id)
      |> Repo.all()

    Enum.uniq([project.client_id, new_user_id | member_ids])
  end

  defp get_group_room_by_project(project_id) do
    from(r in ChatRoom, where: r.room_type == ^:group and r.project_id == ^project_id)
    |> Repo.one()
    |> preload_room()
  end

  def list_rooms(user_id, _user_type) do
    direct_rooms =
      from(r in ChatRoom,
        where: r.room_type == ^:direct and (r.client_id == ^user_id or r.freelancer_id == ^user_id),
        order_by: [desc: r.updated_at]
      )
      |> Repo.all()
      |> Enum.map(&preload_room/1)

    group_room_ids =
      from(p in ChatRoomParticipant, where: p.user_id == ^user_id, select: p.chat_room_id)
      |> Repo.all()

    group_rooms =
      if group_room_ids == [] do
        []
      else
        from(r in ChatRoom,
          where: r.id in ^group_room_ids and r.room_type == ^:group,
          order_by: [desc: r.updated_at]
        )
        |> Repo.all()
        |> Enum.map(&preload_room/1)
      end

    Enum.map(direct_rooms ++ group_rooms, &chat_room_to_map/1)
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
    if authorized?(user_id, room) do
      ok_fun.(room)
    else
      {:error, :forbidden}
    end
  end

  defp authorized?(user_id, %{room_type: :group} = room) do
    room = preload_room(room)

    Enum.any?(room.participants || [], fn p -> p.user_id == user_id end)
  end

  defp authorized?(user_id, room) do
    room.client_id == user_id or room.freelancer_id == user_id
  end

  defp authorize_project_access(project_id, user_id) do
    case Repo.get(Project, project_id) do
      nil ->
        {:error, :not_found}

      %{client_id: ^user_id} ->
        {:ok, :allowed}

      project ->
        member? =
          from(m in ProjectMember, where: m.project_id == ^project.id and m.user_id == ^user_id)
          |> Repo.exists?()

        if member?, do: {:ok, :allowed}, else: {:error, :forbidden}
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

  defp preload_room(nil), do: nil

  defp preload_room(room) do
    Repo.preload(room, [:client, :freelancer, :service_order, :project, participants: :user])
  end

  def chat_room_to_map(room) do
    %{
      id: room.id,
      room_type: Atom.to_string(room.room_type || :direct),
      name: room.name,
      project_id: room.project_id,
      client_id: room.client_id,
      freelancer_id: room.freelancer_id,
      service_order_id: room.service_order_id,
      client: if(room.client, do: user_to_map(room.client), else: nil),
      freelancer: if(room.freelancer, do: user_to_map(room.freelancer), else: nil),
      participants:
        Enum.map(room.participants || [], fn p ->
          %{
            user_id: p.user_id,
            user: if(p.user, do: user_to_map(p.user), else: nil)
          }
        end),
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
        broadcast_to_room(room, msg_map)
        {:ok, msg_map}

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  defp broadcast_to_room(%{room_type: :group} = room, msg_map) do
    room = preload_room(room)

    Enum.each(room.participants || [], fn p ->
      SiteBackend.PubSub.broadcast(p.user_id, %{type: "chat", data: msg_map})
    end)

    :ok
  end

  defp broadcast_to_room(room, msg_map) do
    SiteBackend.PubSub.broadcast(room.client_id, %{type: "chat", data: msg_map})
    SiteBackend.PubSub.broadcast(room.freelancer_id, %{type: "chat", data: msg_map})
    :ok
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

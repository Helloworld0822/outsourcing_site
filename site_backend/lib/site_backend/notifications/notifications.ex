defmodule SiteBackend.Notifications do
  @moduledoc """
  알림 관리 컨텍스트.
  """

  import Ecto.Query
  alias SiteBackend.Repo
  alias SiteBackend.Notification

  def list_notifications(user_id) do
    SiteBackend.Cache.fetch("notifications:list:#{user_id}", fn ->
      from(n in Notification,
        where: n.user_id == ^user_id,
        order_by: [desc: n.inserted_at],
        limit: 50
      )
      |> Repo.all()
      |> Enum.map(&notification_to_map/1)
    end, ttl: 15_000)
  end

  def mark_as_read(user_id, notification_id) do
    case Repo.get(Notification, notification_id) do
      nil ->
        {:error, :not_found}

      %Notification{user_id: ^user_id} = notification ->
        result =
          notification
          |> Notification.changeset(%{is_read: true})
          |> Repo.update()

        _ = SiteBackend.Cache.delete("notifications:list:#{user_id}")
        if match?({:ok, _}, result), do: {:ok, :read}, else: result
    end
  end

  def mark_all_as_read(user_id) do
    from(n in Notification, where: n.user_id == ^user_id and n.is_read == false)
    |> Repo.update_all(set: [is_read: true])

    _ = SiteBackend.Cache.delete("notifications:list:#{user_id}")
    {:ok, :read_all}
  end

  def delete(user_id, notification_id) do
    case Repo.get(Notification, notification_id) do
      nil ->
        {:error, :not_found}

      %Notification{user_id: ^user_id} = notification ->
        result = Repo.delete(notification)
        _ = SiteBackend.Cache.delete("notifications:list:#{user_id}")
        if match?({:ok, _}, result), do: {:ok, :deleted}, else: result

      _ ->
        {:error, :forbidden}
    end
  end

  def create_notification(user_id, attrs) do
    %Notification{}
    |> Notification.changeset(Map.put(attrs, :user_id, user_id))
    |> Repo.insert()
    |> case do
      {:ok, notification} ->
        # Invalidate the per-user list cache so the next read sees
        # the new notification immediately.
        _ = SiteBackend.Cache.delete("notifications:list:#{user_id}")

        SiteBackend.PubSub.broadcast(user_id, %{
          type: "notification",
          data: notification_to_map(notification)
        })

        :ok

      {:error, _} -> :ok
    end
  end

  def notification_to_map(notification) do
    %{
      id: notification.id,
      user_id: notification.user_id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      ref_id: notification.ref_id,
      is_read: notification.is_read,
      inserted_at: format_datetime(notification.inserted_at),
      updated_at: format_datetime(notification.updated_at)
    }
  end

  defp format_datetime(nil), do: nil
  defp format_datetime(datetime), do: NaiveDateTime.to_iso8601(datetime)
end

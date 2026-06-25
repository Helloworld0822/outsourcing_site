defmodule SiteBackend.Services do
  @moduledoc """
  프리랜서 서비스 및 주문 관리 컨텍스트.
  """

  import Ecto.Query
  alias SiteBackend.Repo
  alias SiteBackend.FreelancerService
  alias SiteBackend.ServiceOrder

  @cache_ttl_ms 30_000

  def list_services(query_params) do
    cache_key = "services:list:#{service_cache_key(query_params)}"

    SiteBackend.Cache.fetch(cache_key, fn ->
      base = from(s in FreelancerService, where: s.is_active == true, order_by: [desc: s.inserted_at])

      base =
        case query_params do
          %{"category" => cat} when cat != "" ->
            from(s in base, where: s.category == ^cat)

          _ ->
            base
        end

      base =
        case query_params do
          %{"q" => q} when q != "" ->
            term = "%#{q}%"
            from(s in base, where: ilike(s.title, ^term) or ilike(s.description, ^term))

          _ ->
            base
        end

      base
      |> Repo.all()
      |> Repo.preload(:freelancer)
      |> Enum.map(&service_to_map/1)
    end, ttl: @cache_ttl_ms)
  end

  defp service_cache_key(%{"category" => c, "q" => q}), do: "cat=#{c}|q=#{q}"
  defp service_cache_key(%{"category" => c}), do: "cat=#{c}"
  defp service_cache_key(%{"q" => q}), do: "q=#{q}"
  defp service_cache_key(_), do: "all"

  def list_mine_services(user_id) do
    from(s in FreelancerService,
      where: s.freelancer_id == ^user_id,
      order_by: [desc: s.inserted_at]
    )
    |> Repo.all()
    |> Repo.preload(:freelancer)
    |> Enum.map(&service_to_map/1)
  end

  def create_service(attrs) do
    %FreelancerService{}
    |> FreelancerService.changeset(attrs)
    |> Repo.insert()
    |> case do
      {:ok, service} ->
        service = Repo.preload(service, :freelancer)
        invalidate_service_caches()
        {:ok, service}

      error ->
        error
    end
  end

  def update_service(id, user_id, attrs) do
    case Repo.get(FreelancerService, id) do
      nil ->
        {:error, :not_found}

      service when service.freelancer_id != user_id ->
        {:error, :forbidden}

      service ->
        service
        |> FreelancerService.changeset(attrs)
        |> Repo.update()
        |> case do
          {:ok, updated} ->
            updated = Repo.preload(updated, :freelancer)
            invalidate_service_caches()
            {:ok, updated}

          error ->
            error
        end
    end
  end

  def delete_service(id, user_id) do
    case Repo.get(FreelancerService, id) do
      nil ->
        {:error, :not_found}

      service when service.freelancer_id != user_id ->
        {:error, :forbidden}

      service ->
        case Repo.delete(service) do
          {:ok, _} ->
            invalidate_service_caches()
            {:ok, :deleted}

          error ->
            error
        end
    end
  end

  def create_order(service_id, client_id, requirements) do
    case Repo.get(FreelancerService, service_id) do
      nil ->
        {:error, :not_found}

      service ->
        params = %{
          service_id: service.id,
          client_id: client_id,
          requirements: requirements
        }

        %ServiceOrder{}
        |> ServiceOrder.changeset(params)
        |> Repo.insert()
        |> case do
          {:ok, order} ->
            order = Repo.preload(order, [:client, service: :freelancer])
            notify_freelancer(service, order.client)
            {:ok, order}

          error ->
            error
        end
    end
  end

  def list_client_orders(user_id) do
    from(o in ServiceOrder, where: o.client_id == ^user_id, order_by: [desc: o.inserted_at])
    |> Repo.all()
    |> Repo.preload([:client, service: :freelancer])
    |> Enum.map(&order_to_map/1)
  end

  def list_freelancer_orders(user_id) do
    from(o in ServiceOrder,
      join: s in FreelancerService,
      on: o.service_id == s.id,
      where: s.freelancer_id == ^user_id,
      order_by: [desc: o.inserted_at]
    )
    |> Repo.all()
    |> Repo.preload([:client, service: :freelancer])
    |> Enum.map(&order_to_map/1)
  end

  def service_to_map(service) do
    %{
      id: service.id,
      freelancer_id: service.freelancer_id,
      title: service.title,
      description: service.description,
      category: service.category,
      skills: service.skills || [],
      price: service.price,
      delivery_days: service.delivery_days,
      thumbnail_url: service.thumbnail_url,
      is_active: service.is_active,
      inserted_at: format_datetime(service.inserted_at),
      updated_at: format_datetime(service.updated_at),
      freelancer:
        if(service.freelancer, do: user_to_map(service.freelancer), else: nil)
    }
  end

  def order_to_map(order) do
    %{
      id: order.id,
      service_id: order.service_id,
      client_id: order.client_id,
      requirements: order.requirements,
      status: Atom.to_string(order.status),
      inserted_at: format_datetime(order.inserted_at),
      updated_at: format_datetime(order.updated_at),
      service: service_to_map(order.service),
      client: if(order.client, do: user_to_map(order.client), else: nil)
    }
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

  defp invalidate_service_caches do
    _ = SiteBackend.Cache.invalidate_pattern("services:list:*")
    _ = SiteBackend.Cache.invalidate_pattern("freelancers:list:*")
    :ok
  end

  defp notify_freelancer(service, client) do
    %SiteBackend.Notification{}
    |> SiteBackend.Notification.changeset(%{
      user_id: service.freelancer_id,
      title: "새로운 주문이 들어왔습니다",
      message: "#{client.name}님이 \"#{service.title}\" 서비스를 주문했습니다.",
      type: "order"
    })
    |> Repo.insert()
    |> case do
      {:ok, notification} ->
        SiteBackend.PubSub.broadcast(service.freelancer_id, %{
          type: "notification",
          data: notification_to_map(notification)
        })

        :ok

      {:error, _} ->
        :ok
    end
  end

  defp notification_to_map(notification) do
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
end

defmodule SiteBackend.WebSocketHandler do
  @behaviour :cowboy_websocket

  alias SiteBackend.{Auth, PubSub, Repo, User}

  def init(req, state) do
    access_token = extract_param(req, "token")
    refresh_token = extract_param(req, "refresh_token")

    case resolve_user_id(access_token, refresh_token) do
      {:ok, user_id} ->
        {:cowboy_websocket, Map.put(state, :user_id, user_id), %{idle_timeout: 60_000}}

      {:error, _} ->
        {:ok, :stop, 401}
    end
  end

  def websocket_init(%{user_id: user_id} = state) do
    PubSub.subscribe(user_id, self())

    {:ok, state}
  end

  def websocket_handle({:text, "ping"}, state) do
    {:reply, {:text, "pong"}, state}
  end

  def websocket_handle({:text, _msg}, state) do
    {:ok, state}
  end

  def websocket_info({:broadcast, message}, state) do
    {:reply, {:text, message}, state}
  end

  def websocket_info(_info, state) do
    {:ok, state}
  end

  def terminate(_reason, %{user_id: user_id}) do
    PubSub.unsubscribe(user_id)
    :ok
  end

  def terminate(_reason, _state) do
    :ok
  end

  defp extract_param(req, name) do
    case :cowboy_req.parse_qs(req) do
      qs when is_list(qs) ->
        case Enum.find(qs, fn {k, _v} -> k == name end) do
          {_k, v} -> v
          nil -> nil
        end

      _ ->
        nil
    end
  end

  defp resolve_user_id(nil, nil), do: {:error, :no_token}

  defp resolve_user_id(nil, refresh_token) do
    case verify_refresh_token(refresh_token) do
      {:ok, user_id} -> {:ok, user_id}
      {:error, _} -> {:error, :invalid_token}
    end
  end

  defp resolve_user_id(access_token, _refresh_token) do
    case verify_access_token(access_token) do
      {:ok, user_id} -> {:ok, user_id}
      {:error, _} -> {:error, :invalid_token}
    end
  end

  defp verify_access_token(token) do
    with {:ok, claims} <- Auth.verify_jwt(token),
         %{"type" => "access"} <- claims,
         %{"user_id" => user_id} <- claims do
      if Repo.get(User, user_id), do: {:ok, user_id}, else: {:error, :invalid_user}
    else
      _ -> {:error, :invalid_token}
    end
  end

  defp verify_refresh_token(token) do
    with {:ok, %{"type" => "refresh", "user_id" => user_id, "jti" => jti}} <- Auth.verify_jwt(token),
         %User{} = user <- Repo.get(User, user_id),
         true <- user.refresh_token_hash == User.hash_refresh_token(jti),
         true <- User.refresh_token_valid?(user) do
      {:ok, user_id}
    else
      _ -> {:error, :invalid_token}
    end
  end
end

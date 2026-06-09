defmodule SiteBackend.Application do
  @moduledoc false
  use Application

  def start(_type, _args) do
    port = String.to_integer(System.get_env("PORT") || "4000")
    ws_port = String.to_integer(System.get_env("WS_PORT") || "4001")

    for app <- [:telemetry, :jason, :plug, :plug_cowboy, :cowboy, :ranch, :ecto_sql, :postgrex, :bcrypt_elixir] do
      {:ok, _} = Application.ensure_all_started(app)
    end

    validate_security_config!()

    children = [
      SiteBackend.Repo,
      {Finch, name: SiteBackend.Finch},
      SiteBackend.PubSub,
      SiteBackend.RateLimiter
    ]

    opts = [strategy: :one_for_one, name: SiteBackend.Supervisor]
    with {:ok, sup} <- Supervisor.start_link(children, opts),
         {:ok, _pid} <- Plug.Cowboy.http(SiteBackend.Router, [], ip: {0, 0, 0, 0}, port: port),
         {:ok, _pid} <- start_websocket_server(ws_port) do
      {:ok, sup}
    end
  end

  defp start_websocket_server(port) do
    dispatch = :cowboy_router.compile([
      {:_, [
        {"/ws", SiteBackend.WebSocketHandler, %{}}
      ]}
    ])

    :cowboy.start_clear(
      :ws_listener,
      [{:port, port}],
      %{env: %{dispatch: dispatch}}
    )
  end

  # In production, refuse to start with default/weak secrets.
  defp validate_security_config! do
    jwt_secret = System.get_env("JWT_SECRET")
    secret_key_base = System.get_env("SECRET_KEY_BASE")
    env = System.get_env("MIX_ENV") || "dev"

    if env == "prod" do
      cond do
        is_nil(jwt_secret) or jwt_secret == "" or jwt_secret == "dev_jwt_secret" ->
          raise "JWT_SECRET must be set to a strong value in production"

        byte_size(jwt_secret) < 32 ->
          raise "JWT_SECRET must be at least 32 characters in production"

        is_nil(secret_key_base) or secret_key_base == "" or secret_key_base == "dev_secret" ->
          raise "SECRET_KEY_BASE must be set to a strong value in production"

        true ->
          :ok
      end
    end
  end
end

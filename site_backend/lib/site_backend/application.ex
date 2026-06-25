defmodule SiteBackend.Application do
  @moduledoc false
  use Application

  @default_shutdown_timeout 30_000

  def start(_type, _args) do
    port = String.to_integer(System.get_env("PORT") || "4000")
    ws_port = String.to_integer(System.get_env("WS_PORT") || "4001")

    shutdown_timeout =
      String.to_integer(
        System.get_env("SHUTDOWN_TIMEOUT") || "#{@default_shutdown_timeout}"
      )

    Application.put_env(:site_backend, :shutdown_timeout, shutdown_timeout)

    for app <- [:telemetry, :jason, :plug, :plug_cowboy, :cowboy, :ranch, :ecto_sql, :postgrex, :bcrypt_elixir] do
      {:ok, _} = Application.ensure_all_started(app)
    end

    validate_security_config!()

    children = [
      SiteBackend.Repo,
      SiteBackend.PubSub,
      SiteBackend.RateLimiter,
      {Finch, name: SiteBackend.Finch},
      SiteBackend.Shutdown,
      {SiteBackend.WSListener, [port: ws_port, shutdown_timeout: shutdown_timeout]}
    ]

    supervisor_opts = [strategy: :one_for_one, name: SiteBackend.Supervisor]

    with {:ok, sup} <- Supervisor.start_link(children, supervisor_opts),
         {:ok, _http_pid} <-
           Plug.Cowboy.http(
             SiteBackend.Router,
             [],
             ip: {0, 0, 0, 0},
             port: port
           ) do
      {:ok, sup}
    end
  end

  @doc false
  def prep_stop(state) do
    # Synchronously begin the drain: set the flag and broadcast to all
    # subscribers (e.g. active WebSocket connections) so they can finish
    # in-flight work and emit close frames before the supervision tree
    # is torn down.
    SiteBackend.Shutdown.__begin_drain__()

    # Give subscribers a brief window to react (send close frames, finish
    # in-flight HTTP requests, flush writes, etc.) before the application
    # controller proceeds with the supervised shutdown.
    timeout = Application.get_env(:site_backend, :shutdown_timeout, 30_000)
    SiteBackend.Shutdown.await_drain_broadcast(timeout)

    state
  end

  # In production-like environments, refuse to start with default/weak secrets.
  defp validate_security_config! do
    jwt_secret = System.get_env("JWT_SECRET")
    secret_key_base = System.get_env("SECRET_KEY_BASE")
    env = System.get_env("MIX_ENV") || "dev"

    if env in ["prod", "staging"] do
      cond do
        is_nil(jwt_secret) or jwt_secret == "" or jwt_secret == "dev_jwt_secret" ->
          raise "JWT_SECRET must be set to a strong value in #{env}"

        byte_size(jwt_secret) < 32 ->
          raise "JWT_SECRET must be at least 32 characters in #{env}"

        is_nil(secret_key_base) or secret_key_base == "" or secret_key_base == "dev_secret" ->
          raise "SECRET_KEY_BASE must be set to a strong value in #{env}"

        byte_size(secret_key_base) < 32 ->
          raise "SECRET_KEY_BASE must be at least 32 characters in #{env}"

        true ->
          :ok
      end
    end
  end
end


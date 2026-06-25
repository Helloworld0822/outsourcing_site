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
      # Redis cache: started only when REDIS_URL is set. The Cache module
      # fails open on a missing connection, so absence in dev is fine.
      redix_child(),
      # Background job dispatcher (Task.Supervisor + GenServer worker).
      {Task.Supervisor, name: SiteBackend.Jobs.TaskSupervisor},
      SiteBackend.Jobs.Worker,
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
             port: port,
             # Keep idle TCP connections warm so clients (and CDNs) can
             # reuse them. 75s keeps us under common intermediary
             # defaults (ALB: 60s, nginx: 75s, Cloudflare: 100s).
             protocol_options: [idle_timeout: 75_000, max_keepalive: 100],
             transport_options: [num_acceptors: 8, max_connections: 16_384]
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

  # Start a Redix connection only when REDIS_URL is set. When unset the
  # Cache module falls back to "no cache" semantics (every read is a miss,
  # every write is a no-op) so dev still works without Redis.
  defp redix_child do
    case System.get_env("REDIS_URL") do
      nil ->
        # No-op child so the slot in the supervision tree is preserved.
        %{
          id: :redix_disabled,
          start: {Task, :start_link, [fn -> :ok end]},
          type: :worker,
          restart: :temporary
        }

      url ->
        opts =
          Keyword.merge(redix_opts_from_url(url),
            name: SiteBackend.Redix,
            sync_connect: false,
            exit_on_disconnection: false,
            backoff_initial: 100,
            backoff_max: 5_000
          )

        {Redix, opts}
    end
  end

  # Parse redis://[:password@]host[::port][/db] into the keyword form
  # Redix accepts. Falls back to localhost:6379 on parse failure.
  defp redix_opts_from_url("redis://" <> rest) do
    {auth, rest} = split_auth(rest)
    {host_port, db} = split_db(rest)
    {host, port} = split_host_port(host_port)

    base = [host: host || "redis", port: port || 6379]
    base = if db, do: Keyword.put(base, :database, db), else: base
    if auth, do: Keyword.put(base, :password, auth), else: base
  end

  defp redix_opts_from_url(_), do: [host: "redis", port: 6379]

  defp split_auth(rest) do
    case String.split(rest, "@", parts: 2) do
      [userpass, host] ->
        password = case String.split(userpass, ":", parts: 2) do
          [_user, pass] -> pass
          [pass] -> pass
        end
        {password, host}

      _ ->
        {nil, rest}
    end
  end

  defp split_db(rest) do
    case String.split(rest, "/", parts: 2) do
      [host, db] -> {host, parse_int(db)}
      [host] -> {host, nil}
    end
  end

  defp split_host_port(host) do
    case String.split(host, ":", parts: 2) do
      [h, p] -> {h, parse_int(p)}
      [h] -> {h, nil}
    end
  end

  defp parse_int(s) do
    case Integer.parse(s || "") do
      {n, _} -> n
      :error -> nil
    end
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


defmodule SiteBackend.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  def start(_type, _args) do
    port = String.to_integer(System.get_env("PORT") || "4000")

    for app <- [:telemetry, :jason, :plug, :plug_cowboy, :cowboy, :ranch, :ecto_sql, :postgrex, :bcrypt_elixir] do
      {:ok, _} = Application.ensure_all_started(app)
    end

    children = [
      SiteBackend.Repo,
      {Finch, name: SiteBackend.Finch}
    ]

    opts = [strategy: :one_for_one, name: SiteBackend.Supervisor]
    with {:ok, sup} <- Supervisor.start_link(children, opts),
         {:ok, _pid} <- Plug.Cowboy.http(SiteBackend.Router, [], ip: {0, 0, 0, 0}, port: port) do
      {:ok, sup}
    end
  end
end

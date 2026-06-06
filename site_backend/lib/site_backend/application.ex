defmodule SiteBackend.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  def start(_type, _args) do
    port = String.to_integer(System.get_env("PORT") || "4000")

    children = [
      SiteBackend.Repo,
      {Plug.Cowboy,
       scheme: :http,
       plug: SiteBackend.Router,
       options: [port: port],
       shutdown: 10_000}
    ]

    opts = [strategy: :one_for_one, name: SiteBackend.Supervisor]
    Supervisor.start_link(children, opts)
  end
end

defmodule SiteBackend.MixProject do
  use Mix.Project

  def project do
    [
      app: :site_backend,
      version: "0.1.0",
      elixir: "~> 1.18",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  # Run "mix help compile.app" to learn about applications.
  def application do
    [
      extra_applications: [:logger],
      mod: {SiteBackend.Application, []}
    ]
  end

  # Run "mix help deps" to learn about dependencies.
  defp deps do
    [
      {:cowboy, "~> 2.10"},
      {:plug, "~> 1.14"},
      {:plug_cowboy, "~> 2.6"},
      {:ecto_sql, "~> 3.10"},
      {:postgrex, ">= 0.0.0"},
      {:jason, "~> 1.4"},
      {:joken, "~> 2.6"},
      {:bcrypt_elixir, "~> 3.0"},
      {:finch, "~> 0.18"},
      {:telemetry, "~> 1.0"}
    ]
  end
end

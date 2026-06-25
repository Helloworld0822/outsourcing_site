defmodule SiteBackend.Jobs.Handlers.Audit do
  @moduledoc """
  Job handler for deferred audit log writes.

  Used for low-priority audit events (slow-path admin actions) that
  we do not want to block the request on. Critical security events
  (login, failed login, lockout) are written synchronously in
  `SiteBackend.SecurityAudit`.
  """

  require Logger

  def run(%{event: event, actor: actor, meta: meta}) do
    Logger.info("[Jobs.Audit] #{event} actor=#{inspect(actor)} meta=#{inspect(meta)}")
    :ok
  end

  def run(other) do
    {:error, {:invalid_payload, other}}
  end
end

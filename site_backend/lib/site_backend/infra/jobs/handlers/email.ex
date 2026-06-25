defmodule SiteBackend.Jobs.Handlers.Email do
  @moduledoc """
  Job handler that delivers a transactional email. Delegates to
  `SiteBackend.Email` (Resend API) and is safe to retry on transient
  failures (e.g. Resend 5xx).
  """

  alias SiteBackend.Email

  def run(%{kind: :verification, to: to, token: token}) do
    Email.send_verification_email(to, token)
  end

  def run(other) do
    {:error, {:invalid_payload, other}}
  end
end

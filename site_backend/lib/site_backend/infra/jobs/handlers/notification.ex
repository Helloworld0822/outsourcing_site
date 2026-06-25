defmodule SiteBackend.Jobs.Handlers.Notification do
  @moduledoc """
  Job handler that delivers a single notification to a user.

  Used by the application when a side-effect (project application,
  chat message, status change) needs to fan out to a recipient via
  WebSocket. We keep the handler dumb: it just delegates to the
  existing `SiteBackend.Notifications` context.
  """

  alias SiteBackend.Notifications

  def run(%{user_id: user_id, type: type, ref_id: ref_id, title: title, message: message}) do
    attrs = %{type: type, ref_id: ref_id, title: title, message: message}
    Notifications.create_notification(user_id, attrs)
  end

  def run(other) do
    {:error, {:invalid_payload, other}}
  end
end

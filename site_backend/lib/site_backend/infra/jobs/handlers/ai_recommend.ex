defmodule SiteBackend.Jobs.Handlers.AiRecommend do
  @moduledoc """
  Job handler that pre-warms the AI recommendation cache for a user.

  Currently a stub: the actual OpenAI call is made inline in the
  router (so the user gets an immediate response). The job exists
  so the architecture has a place to plug in async pre-warming /
  background refreshes later without touching the router.
  """

  require Logger

  def run(%{prompt: prompt}) when is_binary(prompt) do
    Logger.debug("[Jobs.AiRecommend] would warm cache for prompt length=#{byte_size(prompt)}")
    :ok
  end

  def run(other) do
    {:error, {:invalid_payload, other}}
  end
end

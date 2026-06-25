defmodule SiteBackend.Jobs.DLQ do
  @moduledoc """
  Dead-letter store for jobs that exhausted their retry budget.

  The implementation is intentionally minimal: it logs the failure
  with a structured payload. A real ops setup would forward these
  to Sentry or a dedicated `job_dlq` table for human inspection.
  """

  require Logger

  @spec record(map(), term()) :: :ok
  def record(job, reason) do
    Logger.error(
      "[Jobs.DLQ] kind=#{job.kind} attempt=#{job.attempt} reason=#{inspect(reason)} payload=#{inspect(job.payload)}"
    )

    :ok
  end
end

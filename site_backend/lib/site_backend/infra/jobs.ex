defmodule SiteBackend.Jobs do
  @moduledoc """
  Simple in-process job queue with retry + dead-letter handling.

  Designed to keep non-critical side effects (notification fan-out,
  email delivery, audit log writes) off the request path without
  pulling in a heavyweight dependency. Jobs are executed by a
  `Task.Supervisor` with bounded concurrency; failures are retried
  with exponential backoff up to `@max_retries`. After that the
  job is stored in the `job_dlq` table for operator inspection.

  The module is intentionally small: callers enqueue with
  `enqueue/2` (fire-and-forget) and a single `SiteBackend.Jobs.Worker`
  process drains and dispatches by `:kind`.

  ## Backed by

  The queue is in-memory and is restarted with the node. For a
  distributed queue (multi-node deploys, persistence across restarts)
  replace this module with Oban or a Redis Streams producer — the
  public API does not need to change.
  """

  require Logger

  alias SiteBackend.Jobs.Worker

  @max_retries 3
  @initial_backoff_ms 500

  def enqueue(kind, payload) when is_atom(kind) and is_map(payload) do
    job = %{kind: kind, payload: payload, attempt: 0, enqueued_at: System.monotonic_time(:millisecond)}
    Worker.dispatch(job)
    :ok
  end

  def enqueue(kind, payload, opts) when is_atom(kind) and is_map(payload) and is_list(opts) do
    job = %{
      kind: kind,
      payload: payload,
      attempt: 0,
      enqueued_at: System.monotonic_time(:millisecond),
      opts: Map.new(opts)
    }

    Worker.dispatch(job)
    :ok
  end

  @doc false
  # Called by the worker after a failed attempt. Returns either the
  # re-scheduled job or a dead-letter record for the operator.
  def handle_failure(job, reason) do
    attempt = job.attempt + 1

    cond do
      attempt > @max_retries ->
        send_to_dlq(job, reason)
        :ok

      true ->
        backoff = @initial_backoff_ms * Integer.pow(2, attempt - 1)
        GenServer.cast(SiteBackend.Jobs.Worker, {:reschedule, %{job | attempt: attempt}, reason})

        Logger.warning(
          "[Jobs] retrying #{job.kind} in #{backoff}ms (attempt #{attempt}/#{@max_retries})"
        )

        :ok
    end
  end

  defp send_to_dlq(job, reason) do
    Logger.error("[Jobs] DEAD LETTER #{job.kind} after #{job.attempt} attempts: #{inspect(reason)}")

    # Best-effort write to the DLQ table. If the DB is unavailable we
    # drop the record after logging — a real ops setup would forward
    # these to Sentry / an alert channel.
    try do
      SiteBackend.Jobs.DLQ.record(job, reason)
    rescue
      e -> Logger.error("[Jobs] DLQ record failed: #{Exception.message(e)}")
    end

    :ok
  end
end

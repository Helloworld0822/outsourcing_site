defmodule SiteBackend.Jobs.Worker do
  @moduledoc """
  Job dispatcher. Owns the registered handler for each `kind` and
  delegates execution to a `Task.Supervisor` so jobs run concurrently
  but never block the request path.
  """

  use GenServer

  require Logger

  @task_supervisor_name SiteBackend.Jobs.TaskSupervisor

  # ── Handler registry ────────────────────────────────────────────
  # Add new job kinds by extending the @handlers map. The value is
  # an `n`-arity function invoked with `payload`.
  @handlers %{
    send_notification: &SiteBackend.Jobs.Handlers.Notification.run/1,
    send_email: &SiteBackend.Jobs.Handlers.Email.run/1,
    ai_recommendation: &SiteBackend.Jobs.Handlers.AiRecommend.run/1,
    audit: &SiteBackend.Jobs.Handlers.Audit.run/1
  }

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  @doc false
  def dispatch(job) do
    GenServer.cast(__MODULE__, {:dispatch, job})
  end

  # ── GenServer ───────────────────────────────────────────────────

  @impl true
  def init(_opts) do
    {:ok, %{inflight: MapSet.new()}}
  end

  @impl true
  def handle_cast({:dispatch, job}, state) do
    Task.Supervisor.start_child(@task_supervisor_name, fn -> run(job) end)
    {:noreply, state}
  end

  def handle_cast({:reschedule, job, _reason}, state) do
    Task.Supervisor.start_child(@task_supervisor_name, fn -> run(job) end)
    {:noreply, state}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  defp run(job) do
    case Map.fetch(@handlers, job.kind) do
      {:ok, handler} ->
        try do
          handler.(job.payload)
        rescue
          e ->
            Logger.error("[Jobs.Worker] #{job.kind} crashed: #{Exception.message(e)}")
            SiteBackend.Jobs.handle_failure(job, {:exception, e})
        catch
          kind, reason ->
            Logger.error("[Jobs.Worker] #{job.kind} caught #{kind}: #{inspect(reason)}")
            SiteBackend.Jobs.handle_failure(job, {kind, reason})
        end

      :error ->
        Logger.error("[Jobs.Worker] no handler registered for kind=#{inspect(job.kind)}")
    end
  end
end

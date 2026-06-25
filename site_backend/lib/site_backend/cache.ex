defmodule SiteBackend.Cache do
  @moduledoc """
  Thin, fault-tolerant Redis cache wrapper around `:redix`.

  Designed for read-heavy public endpoints (project lists, service
  catalogues, freelancer profiles). On a cache miss the caller is
  expected to compute the value and `write/3` it back. On a Redis
  failure we **fail open** (return `nil` and log) so the API never
  becomes unavailable because the cache is down.

  ## Usage

      value =
        case Cache.read("projects:list:home") do
          {:ok, cached} -> cached
          _ ->
            fresh = expensive_query()
            Cache.write("projects:list:home", fresh, ttl: 30_000)
            fresh
        end
  """

  require Logger

  @default_ttl 60_000

  # Bump this when the cache value's *shape* changes in a backwards-
  # incompatible way. Old keys are still scannable but will simply
  # miss on read (JSON decode of the new shape against the old data
  # would fail) and be replaced naturally.
  @namespace "crewlink:v1"

  @doc "Returns `{:ok, value}` on hit, `:miss` on miss, or `{:error, reason}` on failure."
  @spec read(String.t()) :: {:ok, term()} | :miss | {:error, term()}
  def read(key) when is_binary(key) do
    namespaced = namespaced(key)

    case cmd(["GET", namespaced]) do
      {:ok, nil} -> :miss
      {:ok, raw} when is_binary(raw) -> decode(raw)
      {:error, reason} -> log_error(:read, key, reason)
    end
  end

  @doc "Writes `value` to Redis with a TTL (ms). Returns :ok | {:error, reason}."
  @spec write(String.t(), term(), keyword()) :: :ok | {:error, term()}
  def write(key, value, opts \\ []) do
    ttl = Keyword.get(opts, :ttl, @default_ttl)

    case encode(value) do
      {:ok, payload} ->
        cmd(["SET", namespaced(key), payload, "PX", to_string(ttl)])

      {:error, reason} ->
        log_error(:encode, key, reason)
        {:error, reason}
    end
  end

  @doc "Deletes a key. Returns the number of keys removed (0 or 1)."
  @spec delete(String.t()) :: non_neg_integer() | {:error, term()}
  def delete(key) when is_binary(key) do
    case cmd(["DEL", namespaced(key)]) do
      {:ok, count} -> count
      {:error, reason} -> log_error(:delete, key, reason)
    end
  end

  @doc """
  Returns the cached value if present, otherwise calls `fun`, caches
  the result with `opts`, and returns it.
  """
  @spec fetch(String.t(), (-> term()), keyword()) :: term()
  def fetch(key, fun, opts \\ []) when is_function(fun, 0) do
    case read(key) do
      {:ok, value} ->
        value

      _ ->
        value = fun.()
        _ = write(key, value, opts)
        value
    end
  end

  @doc "Invalidates keys matching a glob pattern. Returns count of removed keys."
  @spec invalidate_pattern(String.t()) :: non_neg_integer() | {:error, term()}
  def invalidate_pattern(pattern) when is_binary(pattern) do
    # SCAN cursor walk to avoid the blocking KEYS command. We match
    # against the namespaced prefix so we don't blow away keys written
    # by other apps that happen to share the same Redis.
    scan_and_delete("0", namespaced(pattern), 0)
  end

  defp scan_and_delete(cursor, pattern, total) do
    case cmd(["SCAN", cursor, "MATCH", pattern, "COUNT", "200"]) do
      {:ok, [next, batch]} ->
        removed = delete_batch(batch)
        total = total + removed

        if next in ["0", 0] do
          total
        else
          scan_and_delete(next, pattern, total)
        end

      {:error, reason} ->
        log_error(:invalidate, pattern, reason)
        {:error, reason}
    end
  end

  defp delete_batch([]), do: 0
  defp delete_batch(keys) when is_list(keys) do
    case cmd(["DEL" | keys]) do
      {:ok, count} -> count
      _ -> 0
    end
  end

  defp namespaced(key), do: "#{@namespace}:#{key}"

  # ── Encoding ─────────────────────────────────────────────────────

  defp encode(value), do: {:ok, Jason.encode!(value)}

  defp decode(nil), do: :miss
  defp decode(raw) when is_binary(raw) do
    case Jason.decode(raw) do
      {:ok, decoded} -> {:ok, decoded}
      {:error, _} = err -> err
    end
  end

  # ── Redix plumbing ──────────────────────────────────────────────

  defp cmd(command) do
    case redix() do
      nil -> {:error, :no_redis}
      pid -> Redix.command(pid, command, timeout: 500)
    end
  end

  @doc false
  def redix do
    case Process.whereis(SiteBackend.Redix) do
      nil -> nil
      pid -> pid
    end
  end

  defp log_error(op, key, reason) do
    Logger.warning("[Cache] #{op} #{inspect(key)} failed: #{inspect(reason)}")
    {:error, reason}
  end
end

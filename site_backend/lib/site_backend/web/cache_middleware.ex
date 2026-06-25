defmodule SiteBackend.Web.CacheMiddleware do
  @moduledoc """
  HTTP cache + conditional GET middleware.

  For `GET` requests to public read-only endpoints, this plug:

    1. Sets `Cache-Control` directives (private vs public, max-age) so
       browsers and CDNs know how long the response is fresh.
    2. Computes a strong ETag from the response body's SHA-256.
    3. If the request carries `If-None-Match`, short-circuits with
       `304 Not Modified` (no body) and saves bandwidth.
    4. Sends `Vary: Accept, Accept-Encoding` so caches don't serve a
       compressed body to a client that didn't ask for it.

  Per-route cache lifetimes live in `@cache_durations` and are keyed by
  the request path. The set of cached paths is intentionally small
  (project list, service list, freelancer list); authenticated or
  user-specific endpoints stay `private, no-store`.
  """

  @behaviour Plug

  import Plug.Conn

  # Per-route cache policy. The triple is
  # {max_age_seconds, scope, stale_while_revalidate_seconds}.
  # SWR lets CDNs and browsers serve the cached response while they
  # fetch a fresh one in the background, smoothing spikes in
  # traffic against an upstream that just invalidated the cache.
  @cache_durations %{
    "/projects" => {60, :public, 120},
    "/freelancer/services" => {30, :public, 60},
    "/freelancers" => {60, :public, 120}
  }

  def init(opts), do: opts

  def call(conn, _opts) do
    register_before_send(conn, &maybe_etag/1)
  end

  defp maybe_etag(conn) do
    # CompressMiddleware may re-issue the response with a compressed
    # body, which can cause before_send hooks to run a second time.
    # Use `conn.private` (not `assigns`, which gets serialized into the
    # response) to mark that we've already applied the policy.
    if conn.private[:cache_middleware_applied] do
      conn
    else
      conn = put_private(conn, :cache_middleware_applied, true)

      case cache_policy(conn) do
        :no_cache ->
          conn

        {max_age, scope, swr} ->
          # Don't cache error responses – a 4xx/5xx that comes out of
          # a broken cache will keep poisoning the public surface until
          # the cache TTL elapses.
          if conn.status && conn.status >= 400 do
            conn
          else
            body = response_body(conn)
            size = byte_size(body || "")

            cond do
              is_nil(body) or size == 0 ->
                conn

              size < 32 ->
                # Skip ETags for tiny payloads – the header cost exceeds the saving.
                put_cache_control(conn, max_age, scope, swr)

              true ->
                handle_conditional(conn, body, max_age, scope, swr)
            end
          end
      end
    end
  end

  # ── helpers ────────────────────────────────────────────────

  defp cache_policy(%Plug.Conn{method: "GET"} = conn) do
    case Map.get(@cache_durations, conn.request_path) do
      nil -> :no_cache
      {max_age, scope, swr} -> {max_age, scope, swr}
    end
  end

  defp cache_policy(_), do: :no_cache

  defp response_body(conn) do
    case conn.resp_body do
      %Plug.Conn.Unfetched{} -> nil
      body when is_binary(body) -> body
      _ -> nil
    end
  end

  defp put_cache_control(conn, max_age, :public, swr) do
    conn
    |> put_resp_header("cache-control", "public, max-age=#{max_age}, stale-while-revalidate=#{swr}")
    |> put_resp_header("vary", "Accept, Accept-Encoding")
  end

  defp put_cache_control(conn, max_age, :private, swr) do
    conn
    |> put_resp_header("cache-control", "private, max-age=#{max_age}, stale-while-revalidate=#{swr}")
    |> put_resp_header("vary", "Accept, Accept-Encoding")
  end

  defp handle_conditional(conn, body, max_age, scope, swr) do
    etag = compute_etag(body)

    case get_req_header(conn, "if-none-match") do
      [tag] when tag == etag ->
        conn
        |> put_resp_header("etag", etag)
        |> put_resp_header("cache-control", cache_directive(max_age, scope, swr))
        |> put_resp_header("vary", "Accept, Accept-Encoding")
        |> send_resp(304, "")

      _ ->
        conn
        |> put_resp_header("etag", etag)
        |> put_resp_header("cache-control", cache_directive(max_age, scope, swr))
        |> put_resp_header("vary", "Accept, Accept-Encoding")
    end
  end

  defp cache_directive(max_age, :public, swr),
    do: "public, max-age=#{max_age}, stale-while-revalidate=#{swr}"

  defp cache_directive(max_age, :private, swr),
    do: "private, max-age=#{max_age}, stale-while-revalidate=#{swr}"

  # Hex-encoded SHA-256, with quotes per RFC 7232.
  defp compute_etag(body) do
    :crypto.hash(:sha256, body)
    |> Base.encode16(case: :lower)
    |> binary_part(0, 32)
    |> (&"\"#{&1}\"").()
  end
end

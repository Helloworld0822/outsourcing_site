defmodule SiteBackend.Auth do
  @moduledoc false

  alias SiteBackend.Token

  @access_token_ttl 3600

  def generate_jwt(claims) when is_map(claims) do
    full_claims = Map.merge(default_claims(), claims)
    Joken.encode_and_sign(full_claims, Token.signer(), [])
  end

  def generate_access_token(user_id) do
    case generate_jwt(%{
      "user_id" => user_id,
      "type" => "access"
    }) do
      {:ok, token, _claims} -> token
      _ -> raise "Failed to generate access token"
    end
  end

  def generate_refresh_token(user_id, jti) do
    case generate_jwt(%{
      "user_id" => user_id,
      "type" => "refresh",
      "jti" => jti,
      "exp" => Joken.current_time() + 60 * 60 * 24 * 30
    }) do
      {:ok, token, _claims} -> token
      _ -> raise "Failed to generate refresh token"
    end
  end

  def verify_jwt(token) when is_binary(token) do
    with {:ok, claims} <- Joken.verify(token, Token.signer(), []),
         :ok <- check_exp(claims) do
      {:ok, claims}
    end
  end

  def verify_jwt(_), do: {:error, :invalid_token}

  defp check_exp(claims) do
    case Map.get(claims, "exp") do
      exp when is_integer(exp) ->
        if exp > Joken.current_time(), do: :ok, else: {:error, :expired}

      _ ->
        :ok
    end
  end

  defp default_claims do
    %{
      "iss" => "outsourcing_site",
      "aud" => "outsourcing_site",
      "exp" => Joken.current_time() + @access_token_ttl
    }
  end
end

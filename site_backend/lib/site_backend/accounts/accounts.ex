defmodule SiteBackend.Accounts do
  @moduledoc """
  사용자 인증 및 관리 컨텍스트.
  """

  require Logger

  alias SiteBackend.Repo
  alias SiteBackend.User
  alias SiteBackend.Login
  alias SiteBackend.Email
  alias SiteBackend.Auth
  alias SiteBackend.ErrorMessages
  alias SiteBackend.SecurityAudit
  alias SiteBackend.RateLimiter

  def signup(conn) do
    ip = request_ip(conn)
    params =
      conn.body_params
      |> Map.put("account_type", Map.get(conn.body_params, "account_type") || Map.get(conn.body_params, "role"))
      |> Map.drop(["role"])

    changeset = User.registration_changeset(%User{}, params)

    case Repo.insert(changeset) do
      {:ok, user} ->
        user
        |> User.set_verification_token()
        |> Repo.update()
        |> case do
          {:ok, verified_user} ->
            Email.send_verification_email(user.email, verified_user.email_verification_token)
            |> case do
              {:ok, _} -> :ok
              {:error, reason} -> Logger.error("Failed to send verification email to #{user.email}: #{reason}")
            end
          {:error, _} -> :ok
        end

        SecurityAudit.log_signup(user.id, user.email, ip)

        {:ok, user}

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  def login(conn) do
    ip = request_ip(conn)

    with email when is_binary(email) <- Map.get(conn.body_params, "email"),
         password when is_binary(password) <- Map.get(conn.body_params, "password") do
      do_login(conn, ip, email, password)
    else
      _ -> {:error, 400, "email and password are required"}
    end
  end

  defp do_login(_conn, ip, email, password) do
    case Repo.get_by(User, email: email) do
      nil ->
        SecurityAudit.log_failed_login(email, ip)
        {:error, 401, "이메일 또는 비밀번호가 올바르지 않습니다."}

      user ->
        if User.locked?(user) do
          SecurityAudit.log_account_lockout(user.id, email, ip)
          remaining_minutes = NaiveDateTime.diff(user.locked_until, NaiveDateTime.utc_now(), :minute) + 1
          {:error, 423, "계정이 잠겼습니다. #{remaining_minutes}분 후에 다시 시도해주세요."}
        else
          if Bcrypt.verify_pass(password, user.password_hash) do
            if not user.email_verified do
              {:error, 403, "이메일 인증이 필요합니다. 받은 편지함을 확인해주세요."}
            else
              user
              |> User.reset_failed_logins()
              |> Repo.update()

              RateLimiter.reset("login:#{ip}")

              access_token = Auth.generate_access_token(user.id)
              raw_refresh_token = User.generate_refresh_token()
              jwt_refresh_token = Auth.generate_refresh_token(user.id, raw_refresh_token)

              user
              |> User.set_refresh_token(raw_refresh_token)
              |> Repo.update()

              login_changeset =
                Login.changeset(%Login{}, %{
                  user_id: user.id,
                  ip_address: ip
                })

              case Repo.insert(login_changeset) do
                {:ok, _login} ->
                  SecurityAudit.log_successful_login(user.id, email, ip)

                  {:ok, %{
                    token: access_token,
                    refresh_token: jwt_refresh_token,
                    user: user_to_map(user)
                  }}

                {:error, changeset} ->
                  {:error, 500, ErrorMessages.translate_changeset_errors(changeset)}
              end
            end
          else
            SecurityAudit.log_failed_login(email, ip)

            case user
                 |> User.increment_failed_login()
                 |> Repo.update() do
              {:ok, updated_user} ->
                if User.locked?(updated_user) do
                  SecurityAudit.log_account_lockout(user.id, email, ip)
                  {:error, 423, "로그인 시도가 너무 많아 계정이 15분간 잠겼습니다."}
                else
                  {:error, 401, "이메일 또는 비밀번호가 올바르지 않습니다."}
                end

              {:error, _} ->
                {:error, 401, "이메일 또는 비밀번호가 올바르지 않습니다."}
            end
          end
        end
    end
  end

  def refresh(refresh_token) do
    cond do
      not is_binary(refresh_token) or byte_size(refresh_token) == 0 ->
        {:error, 400, "refresh_token이 필요합니다."}

      true ->
        case Auth.verify_jwt(refresh_token) do
          {:ok, %{"type" => "refresh", "user_id" => user_id, "jti" => jti}} ->
            user = Repo.get(User, user_id)

            if user do
              token_hash = User.hash_refresh_token(jti)

              if user.refresh_token_hash == token_hash and User.refresh_token_valid?(user) do
                new_access_token = Auth.generate_access_token(user.id)
                new_raw_refresh_token = User.generate_refresh_token()
                new_jwt_refresh_token = Auth.generate_refresh_token(user.id, new_raw_refresh_token)

                user
                |> User.set_refresh_token(new_raw_refresh_token)
                |> Repo.update()

                {:ok, %{
                  token: new_access_token,
                  refresh_token: new_jwt_refresh_token
                }}
              else
                {:error, 401, "refresh_token이 유효하지 않거나 만료되었습니다."}
              end
            else
              {:error, 401, "사용자를 찾을 수 없습니다."}
            end

          {:ok, _} ->
            {:error, 401, "refresh_token이 아닙니다."}

          {:error, _} ->
            {:error, 401, "refresh_token이 유효하지 않거나 만료되었습니다."}
        end
    end
  end

  def logout(user) do
    user
    |> User.clear_refresh_token()
    |> Repo.update()

    :ok
  end

  def verify_email(token) do
    case token do
      token when is_binary(token) and byte_size(token) > 0 ->
        case Repo.get_by(User, email_verification_token: token) do
          nil ->
            {:error, 400, "유효하지 않거나 만료된 인증 링크입니다. 이미 인증을 완료하셨다면 로그인해주세요."}

          user ->
            if user.email_verified do
              {:ok, "이미 인증된 이메일입니다. 로그인해주세요."}
            else
              user
              |> User.verify_email()
              |> Repo.update()
              |> case do
                {:ok, _} ->
                  SecurityAudit.log_email_verification(user.id, user.email)
                  {:ok, "이메일 인증이 완료되었습니다."}

                {:error, _} ->
                  {:error, 500, "이메일 인증 처리 중 오류가 발생했습니다."}
              end
            end
        end

      _ ->
        {:error, 400, "인증 토큰이 필요합니다."}
    end
  end

  def request_verification(email, conn) do
    ip = request_ip(conn)

    case Repo.get_by(User, email: email) do
      nil ->
        {:ok, "인증 이메일이 발송되었습니다."}

      user ->
        if user.email_verified do
          {:ok, "이미 인증된 이메일입니다."}
        else
          key = "verify:#{ip}"

          case RateLimiter.hit(key, 3, 3600) do
            {:error, :rate_limited, retry_after} ->
              {:error, 429, "인증 메일 발송이 너무 많습니다. #{retry_after}초 후에 다시 시도해주세요."}

            {:ok, _} ->
              user
              |> User.set_verification_token()
              |> Repo.update()
              |> case do
                {:ok, verified_user} ->
                  Email.send_verification_email(user.email, verified_user.email_verification_token)
                  |> case do
                    {:ok, _} -> :ok
                    {:error, reason} -> Logger.error("Failed to resend verification email to #{user.email}: #{reason}")
                  end

                  {:ok, "인증 이메일이 발송되었습니다."}

                {:error, _} ->
                  {:error, 500, "인증 메일 발송에 실패했습니다."}
              end
          end
        end
    end
  end

  def user_to_map(user) do
    %{
      id: user.id,
      email: user.email,
      name: user.name,
      account_type: Atom.to_string(user.account_type)
    }
  end

  defp request_ip(conn) do
    case Plug.Conn.get_req_header(conn, "x-forwarded-for") do
      [value | _] ->
        value
        |> String.split(",", parts: 2)
        |> List.first()
        |> String.trim()

      _ ->
        conn.remote_ip
        |> :inet.ntoa()
        |> to_string()
    end
  end
end

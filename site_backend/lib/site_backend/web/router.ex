defmodule SiteBackend.Router do
  use Plug.Router
  use Plug.ErrorHandler

  def handle_errors(conn, %{kind: kind, reason: reason, stack: _stack}) do
    body =
      cond do
        Kernel.is_exception(reason) ->
          Jason.encode!(%{error: translate_exception(reason)})

        true ->
          Jason.encode!(%{error: "서버 내부 오류가 발생했습니다."})
      end

    require Logger
    Logger.error("unhandled #{kind}: #{inspect(reason)}")

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(500, body)
  end

  defp translate_exception(%Postgrex.Error{} = e) do
    case e.postgres do
      %{code: :unique_violation, constraint: constraint} ->
        cond do
          String.contains?(constraint, "users_email") -> "이미 가입된 이메일 주소입니다."
          String.contains?(constraint, "project_applications") -> "이미 이 프로젝트에 지원하셨습니다."
          String.contains?(constraint, "_id_index") -> "이미 처리된 요청입니다."
          true -> "이미 존재하는 데이터입니다."
        end

      %{code: :foreign_key_violation} ->
        "존재하지 않는 데이터를 참조하고 있습니다."

      %{code: :not_null_violation, column: column} ->
        field_kr = SiteBackend.ErrorMessages.translate_field(column)
        "#{field_kr}은(는) 반드시 입력해야 합니다."

      _ ->
        "데이터베이스 오류가 발생했습니다."
    end
  end

  defp translate_exception(_), do: "서버 내부 오류가 발생했습니다."

  import Ecto.Query
  require Logger

  alias SiteBackend.Accounts
  alias SiteBackend.Projects
  alias SiteBackend.Services
  alias SiteBackend.Notifications
  alias SiteBackend.Chat
  alias SiteBackend.Profiles

  plug :match
  plug Plug.Parsers, parsers: [:json], json_decoder: Jason, pass: ["*/*"]
  plug SiteBackend.CORSMiddleware
  plug :dispatch

  @login_rate_limit 5
  @login_rate_window 60
  @signup_rate_limit 3
  @signup_rate_window 3600

  # ── Auth ──────────────────────────────────────────────────────────

  post "/signup" do
    key = "signup:#{request_ip(conn)}"

    case SiteBackend.RateLimiter.hit(key, @signup_rate_limit, @signup_rate_window) do
      {:ok, _} ->
        case Accounts.signup(conn) do
          {:ok, user} ->
            send_json(
              conn,
              %{
                message: "회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.",
                email: user.email,
                email_verified: false
              },
              201
            )

          {:error, changeset} ->
            json_error(conn, 400, Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end))
        end

      {:error, :rate_limited, retry_after} ->
        SiteBackend.SecurityAudit.log_rate_limit(key, conn.request_path)

        conn
        |> put_resp_header("retry-after", to_string(retry_after))
        |> json_error(429, "가입 시도가 너무 많습니다. #{retry_after}초 후에 다시 시도해주세요.")
    end
  end

  post "/register" do
    key = "signup:#{request_ip(conn)}"

    case SiteBackend.RateLimiter.hit(key, @signup_rate_limit, @signup_rate_window) do
      {:ok, _} ->
        case Accounts.signup(conn) do
          {:ok, user} ->
            send_json(
              conn,
              %{
                message: "회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.",
                email: user.email,
                email_verified: false
              },
              201
            )

          {:error, changeset} ->
            json_error(conn, 400, Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end))
        end

      {:error, :rate_limited, retry_after} ->
        SiteBackend.SecurityAudit.log_rate_limit(key, conn.request_path)

        conn
        |> put_resp_header("retry-after", to_string(retry_after))
        |> json_error(429, "가입 시도가 너무 많습니다. #{retry_after}초 후에 다시 시도해주세요.")
    end
  end

  post "/login" do
    ip = request_ip(conn)
    key = "login:#{ip}"

    case SiteBackend.RateLimiter.hit(key, @login_rate_limit, @login_rate_window) do
      {:error, :rate_limited, retry_after} ->
        SiteBackend.SecurityAudit.log_rate_limit(key, conn.request_path)

        conn
        |> put_resp_header("retry-after", to_string(retry_after))
        |> json_error(429, "로그인 시도가 너무 많습니다. #{retry_after}초 후에 다시 시도해주세요.")

      {:ok, _} ->
        case Accounts.login(conn) do
          {:ok, data} ->
            send_json(conn, data)

          {:error, status, message} ->
            json_error(conn, status, message)
        end
    end
  end

  post "/refresh" do
    %{"refresh_token" => refresh_token} = conn.body_params

    case Accounts.refresh(refresh_token) do
      {:ok, data} ->
        send_json(conn, data)

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  post "/logout" do
    case authorize_roles(conn, [:client, :freelancer]) do
      {:ok, user} ->
        Accounts.logout(user)
        send_json(conn, %{message: "로그아웃되었습니다."})

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  post "/verify-email" do
    %{"email" => email} = conn.body_params

    case Accounts.request_verification(email, conn) do
      {:ok, message} ->
        send_json(conn, %{message: message})

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  get "/verify-email/:token" do
    case Accounts.verify_email(conn.path_params["token"]) do
      {:ok, message} ->
        send_json(conn, %{message: message})

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  # ── Projects ──────────────────────────────────────────────────────

  get "/projects" do
    projects = Projects.list_projects()
    send_json(conn, %{data: projects})
  end

  post "/projects" do
    case authorize_roles(conn, [:client]) do
      {:ok, user} ->
        params =
          conn.body_params
          |> Map.put("client_id", user.id)
          |> Map.put("client_name", Map.get(conn.body_params, "client_name") || user.name)

        case Projects.create_project(params) do
          {:ok, project} ->
            send_json(conn, %{data: Projects.project_to_map(project)}, 201)

          {:error, changeset} ->
            json_error(conn, 400, Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end))
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  get "/client/projects" do
    case authorize_roles(conn, [:client]) do
      {:ok, user} ->
        projects = Projects.list_client_projects(user.id)
        send_json(conn, %{data: projects})

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  post "/projects/:id/applications" do
    case authorize_roles(conn, [:freelancer]) do
      {:ok, user} ->
        %{"message" => message} = conn.body_params

        case Projects.apply_to_project(conn.path_params["id"], user.id, message) do
          {:ok, application} ->
            send_json(conn, %{data: Projects.application_to_map(application)}, 201)

          {:error, :not_found} ->
            json_error(conn, 404, "project not found")

          {:error, changeset} ->
            json_error(conn, 400, SiteBackend.ErrorMessages.translate_changeset_errors(changeset))
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  get "/freelancer/applications" do
    case authorize_roles(conn, [:freelancer]) do
      {:ok, user} ->
        applications = Projects.list_freelancer_applications(user.id)
        send_json(conn, %{data: applications})

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  # ── Services ──────────────────────────────────────────────────────

  get "/freelancer/services" do
    services = Services.list_services(conn.query_params)
    send_json(conn, %{data: services})
  end

  get "/freelancer/services/mine" do
    case authorize_roles(conn, [:freelancer]) do
      {:ok, user} ->
        services = Services.list_mine_services(user.id)
        send_json(conn, %{data: services})

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  post "/freelancer/services" do
    case authorize_roles(conn, [:freelancer]) do
      {:ok, user} ->
        params = Map.put(conn.body_params, "freelancer_id", user.id)

        case Services.create_service(params) do
          {:ok, service} ->
            send_json(conn, %{data: Services.service_to_map(service)}, 201)

          {:error, changeset} ->
            json_error(conn, 400, Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end))
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  patch "/freelancer/services/:id" do
    case authorize_roles(conn, [:freelancer]) do
      {:ok, user} ->
        case Services.update_service(conn.path_params["id"], user.id, conn.body_params) do
          {:ok, service} ->
            send_json(conn, %{data: Services.service_to_map(service)})

          {:error, :not_found} ->
            json_error(conn, 404, "service not found")

          {:error, :forbidden} ->
            json_error(conn, 403, "forbidden")

          {:error, changeset} ->
            json_error(conn, 400, SiteBackend.ErrorMessages.translate_changeset_errors(changeset))
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  delete "/freelancer/services/:id" do
    case authorize_roles(conn, [:freelancer]) do
      {:ok, user} ->
        case Services.delete_service(conn.path_params["id"], user.id) do
          {:ok, :deleted} ->
            send_json(conn, %{ok: true})

          {:error, :not_found} ->
            json_error(conn, 404, "service not found")

          {:error, :forbidden} ->
            json_error(conn, 403, "forbidden")

          {:error, changeset} ->
            json_error(conn, 400, SiteBackend.ErrorMessages.translate_changeset_errors(changeset))
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  post "/freelancer/services/:id/orders" do
    case authorize_roles(conn, [:client]) do
      {:ok, user} ->
        requirements = Map.get(conn.body_params, "requirements")

        case Services.create_order(conn.path_params["id"], user.id, requirements) do
          {:ok, order} ->
            send_json(conn, %{data: Services.order_to_map(order)}, 201)

          {:error, :not_found} ->
            json_error(conn, 404, "service not found")

          {:error, changeset} ->
            json_error(conn, 400, SiteBackend.ErrorMessages.translate_changeset_errors(changeset))
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  get "/client/service-orders" do
    case authorize_roles(conn, [:client]) do
      {:ok, user} ->
        orders = Services.list_client_orders(user.id)
        send_json(conn, %{data: orders})

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  get "/freelancer/service-orders" do
    case authorize_roles(conn, [:freelancer]) do
      {:ok, user} ->
        orders = Services.list_freelancer_orders(user.id)
        send_json(conn, %{data: orders})

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  # ── Notifications ─────────────────────────────────────────────────

  get "/notifications" do
    case current_user(conn) do
      {:ok, user} ->
        notifications = Notifications.list_notifications(user.id)
        send_json(conn, %{data: notifications})

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  patch "/notifications/:id/read" do
    case current_user(conn) do
      {:ok, user} ->
        case Notifications.mark_as_read(user.id, conn.path_params["id"]) do
          {:ok, :read} ->
            send_json(conn, %{ok: true})

          {:error, :not_found} ->
            json_error(conn, 404, "notification not found")

          {:error, :forbidden} ->
            json_error(conn, 403, "forbidden")
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  patch "/notifications/read-all" do
    case current_user(conn) do
      {:ok, user} ->
        {:ok, :read_all} = Notifications.mark_all_as_read(user.id)
        send_json(conn, %{ok: true})

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  delete "/notifications/:id" do
    case current_user(conn) do
      {:ok, user} ->
        case Notifications.delete(user.id, conn.path_params["id"]) do
          {:ok, :deleted} ->
            send_json(conn, %{ok: true})

          {:error, :not_found} ->
            json_error(conn, 404, "notification not found")

          {:error, :forbidden} ->
            json_error(conn, 403, "forbidden")
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  # ── Chat ──────────────────────────────────────────────────────────

  post "/chat/rooms" do
    case current_user(conn) do
      {:ok, user} ->
        %{"freelancer_id" => freelancer_id} = conn.body_params
        service_order_id = Map.get(conn.body_params, "service_order_id")

        case Chat.get_or_create_room(user.id, freelancer_id, service_order_id) do
          {:ok, room} ->
            send_json(conn, %{data: room})

          {:error, changeset} ->
            json_error(conn, 400, SiteBackend.ErrorMessages.translate_changeset_errors(changeset))
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  get "/chat/rooms" do
    case current_user(conn) do
      {:ok, user} ->
        rooms = Chat.list_rooms(user.id, user.account_type)
        send_json(conn, %{data: rooms})

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  get "/chat/rooms/:id/messages" do
    case current_user(conn) do
      {:ok, user} ->
        case Chat.list_messages(user.id, conn.path_params["id"]) do
          {:ok, messages} ->
            send_json(conn, %{data: messages})

          {:error, :not_found} ->
            json_error(conn, 404, "chat room not found")

          {:error, :forbidden} ->
            json_error(conn, 403, "forbidden")
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  post "/chat/rooms/:id/messages" do
    case current_user(conn) do
      {:ok, user} ->
        %{"content" => content} = conn.body_params

        case Chat.send_message(user.id, conn.path_params["id"], content) do
          {:ok, msg_map} ->
            send_json(conn, %{data: msg_map}, 201)

          {:error, :not_found} ->
            json_error(conn, 404, "chat room not found")

          {:error, :forbidden} ->
            json_error(conn, 403, "forbidden")

          {:error, changeset} ->
            json_error(conn, 400, SiteBackend.ErrorMessages.translate_changeset_errors(changeset))
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  # ── AI Recommendation (inline) ────────────────────────────────────

  post "/ai/recommend" do
    case Map.get(conn.body_params, "prompt") do
      nil ->
        json_error(conn, 400, "prompt is required")

      prompt when is_binary(prompt) and byte_size(prompt) > 0 ->
        api_key = System.get_env("OPENAI_API_KEY")

        if is_nil(api_key) or api_key == "" do
          json_error(conn, 503, "AI 기능이 설정되지 않았습니다. OPENAI_API_KEY 환경변수를 확인해주세요.")
        else
          projects =
            from(p in SiteBackend.Project, order_by: [desc: p.inserted_at], limit: 50)
            |> SiteBackend.Repo.all()

          projects_text =
            projects
            |> Enum.with_index(1)
            |> Enum.map(fn {p, i} ->
              skills = Enum.join(p.skills, ", ")
              budget = p.budget || "미정"
              "#{i}. [ID: #{p.id}] #{p.title} - #{p.description || "설명 없음"} (기술: #{skills}, 예산: #{budget})"
            end)
            |> Enum.join("\n")

          system_prompt = """
          당신은 외주 플랫폼의 AI 어시스턴트입니다. 사용자의 기술 스택과 조건을 분석하여 현재 등록된 프로젝트 중 가장 적합한 것을 추천합니다.
          반드시 다음 JSON 형식으로만 응답하세요 (코드블록 없이 순수 JSON):
          {
            "recommendations": [
              {"project_id": "UUID", "reason": "추천 이유 (2-3문장)"},
              ...
            ],
            "summary": "전체 요약 (1-2문장)"
          }
          최대 3개까지 추천하세요. 적합한 프로젝트가 없으면 recommendations를 빈 배열로 반환하세요.
          """

          user_message = "현재 등록된 프로젝트 목록:\n#{projects_text}\n\n사용자 요청: #{prompt}"

          request_body = Jason.encode!(%{
            model: "gpt-4o-mini",
            messages: [
              %{role: "system", content: system_prompt},
              %{role: "user", content: user_message}
            ],
            temperature: 0.3,
            max_tokens: 1000
          })

          req =
            Finch.build(
              :post,
              "https://api.openai.com/v1/chat/completions",
              [
                {"content-type", "application/json"},
                {"authorization", "Bearer #{api_key}"}
              ],
              request_body
            )

          case Finch.request(req, SiteBackend.Finch, receive_timeout: 30_000) do
            {:ok, %Finch.Response{status: 200, body: body}} ->
              case Jason.decode(body) do
                {:ok, %{"choices" => [%{"message" => %{"content" => content}} | _]}} ->
                  case Jason.decode(content) do
                    {:ok, result} ->
                      enriched =
                        Map.update(result, "recommendations", [], fn recs ->
                          Enum.map(recs, fn rec ->
                            project = Enum.find(projects, fn p -> p.id == rec["project_id"] end)
                            Map.put(rec, "project", if(project, do: Projects.project_to_map(project), else: nil))
                          end)
                          |> Enum.filter(fn rec -> rec["project"] != nil end)
                        end)

                      send_json(conn, enriched)

                    {:error, _} ->
                      json_error(conn, 502, "AI 응답을 파싱할 수 없습니다.")
                  end

                {:ok, %{"error" => %{"message" => msg}}} ->
                  json_error(conn, 502, "OpenAI 오류: #{msg}")

                _ ->
                  json_error(conn, 502, "OpenAI 응답 형식이 올바르지 않습니다.")
              end

            {:ok, %Finch.Response{status: status, body: body}} ->
              err =
                case Jason.decode(body) do
                  {:ok, %{"error" => %{"message" => m}}} -> m
                  _ -> "HTTP #{status}"
                end

              json_error(conn, 502, "OpenAI 요청 실패: #{err}")

            {:error, reason} ->
              Logger.error("Finch error: #{inspect(reason)}")
              json_error(conn, 502, "AI 서버에 연결할 수 없습니다.")
          end
        end

      _ ->
        json_error(conn, 400, "prompt must be a non-empty string")
    end
  end

  # ── Profiles ──────────────────────────────────────────────────────

  get "/profile" do
    case current_user(conn) do
      {:ok, user} ->
        case Profiles.get_profile(user.id) do
          {:ok, profile} ->
            send_json(conn, %{data: profile})

          {:error, :not_found} ->
            json_error(conn, 404, "프로필을 찾을 수 없습니다.")
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  put "/profile" do
    case current_user(conn) do
      {:ok, user} ->
        case Profiles.upsert_profile(user.id, conn.body_params) do
          {:ok, profile} ->
            send_json(conn, %{data: profile})

          {:error, changeset} ->
            json_error(conn, 400, Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end))
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  get "/profiles/:user_id" do
    case Profiles.get_public_profile(conn.path_params["user_id"]) do
      {:ok, profile} ->
        send_json(conn, %{data: profile})

      {:error, :not_found} ->
        json_error(conn, 404, "프로필을 찾을 수 없습니다.")

      {:error, :forbidden} ->
        json_error(conn, 403, "비공개 프로필입니다.")
    end
  end

  get "/freelancers" do
    profiles = Profiles.list_freelancer_profiles(conn.query_params)
    send_json(conn, %{data: profiles})
  end

  # ── Login History (inline) ────────────────────────────────────────

  get "/logins" do
    logins =
      SiteBackend.Repo.all(SiteBackend.Login)
      |> SiteBackend.Repo.preload(:user)
      |> Enum.map(&login_to_map/1)

    send_json(conn, %{data: logins})
  end

  # ── Fallback ──────────────────────────────────────────────────────

  match _ do
    send_resp(conn, 404, "not found")
  end

  # ── Private helpers ───────────────────────────────────────────────

  defp authorize_roles(conn, roles) do
    with {:ok, user} <- current_user(conn) do
      if user.account_type in roles do
        {:ok, user}
      else
        {:error, 403, "forbidden"}
      end
    end
  end

  defp current_user(conn) do
    with token when is_binary(token) <- bearer_token(conn),
         {:ok, claims} <- SiteBackend.Auth.verify_jwt(token),
         %{"type" => "access"} <- claims,
         user_id when is_binary(user_id) <- Map.get(claims, "user_id") || Map.get(claims, :user_id),
         user when not is_nil(user) <- SiteBackend.Repo.get(SiteBackend.User, user_id) do
      {:ok, user}
    else
      reason ->
        Logger.warning("current_user failed: #{inspect(reason)}")
        {:error, 401, "unauthorized"}
    end
  end

  defp bearer_token(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> token
      ["bearer " <> token] -> token
      _ -> nil
    end
  end

  defp send_json(conn, body, status \\ 200) do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(status, Jason.encode!(body))
  end

  defp json_error(conn, status, error) do
    send_json(conn, %{error: error}, status)
  end

  defp format_datetime(nil), do: nil
  defp format_datetime(datetime), do: NaiveDateTime.to_iso8601(datetime)

  defp request_ip(conn) do
    case get_req_header(conn, "x-forwarded-for") do
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

  defp login_to_map(login) do
    %{
      id: login.id,
      user_id: login.user_id,
      user_email: login.user && login.user.email,
      ip_address: login.ip_address,
      inserted_at: format_datetime(login.inserted_at)
    }
  end
end

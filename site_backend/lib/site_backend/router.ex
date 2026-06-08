defmodule SiteBackend.Router do
  use Plug.Router
  use Plug.ErrorHandler

  def handle_errors(conn, %{kind: kind, reason: reason, stack: _stack}) do
    body =
      cond do
        Kernel.is_exception(reason) ->
          Jason.encode!(%{error: "unhandled exception", type: reason.__struct__ |> Module.split() |> Enum.join(".")})

        true ->
          Jason.encode!(%{error: "internal server error", reason: inspect(reason)})
      end

    require Logger
    Logger.error("unhandled #{kind}: #{inspect(reason)}")

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(500, body)
  end

  import Ecto.Query

  alias SiteBackend.{FreelancerService, Login, Notification, Project, ProjectApplication, Repo, ServiceOrder, User}

  plug :match
  plug Plug.Parsers, parsers: [:json], json_decoder: Jason
  plug :dispatch

  post "/signup" do
    handle_signup(conn)
  end

  post "/register" do
    handle_signup(conn)
  end

  post "/login" do
    %{"email" => email, "password" => password} = conn.body_params

    case Repo.get_by(User, email: email) do
      nil ->
        json_error(conn, 401, "invalid credentials")

      user ->
        if Bcrypt.verify_pass(password, user.password_hash) do
          {:ok, token, _claims} = SiteBackend.Auth.generate_jwt(%{user_id: user.id})

          login_changeset =
            Login.changeset(%Login{}, %{
              user_id: user.id,
              ip_address: request_ip(conn)
            })

          case Repo.insert(login_changeset) do
            {:ok, _login} ->
              conn
              |> put_resp_content_type("application/json")
              |> send_resp(200, Jason.encode!(%{token: token, user: user_to_map(user)}))

            {:error, changeset} ->
              json_error(
                conn,
                500,
                Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end)
              )
            end
        else
          json_error(conn, 401, "invalid credentials")
        end
    end
  end

  get "/projects" do
    projects =
      from(p in Project, order_by: [desc: p.inserted_at])
      |> Repo.all()
      |> Enum.map(&project_to_map/1)

    send_json(conn, %{data: projects})
  end

  post "/projects" do
    case authorize_roles(conn, [:client]) do
      {:ok, user} ->
        params =
          conn.body_params
          |> Map.put("client_id", user.id)
          |> Map.put("client_name", Map.get(conn.body_params, "client_name") || user.name)

        changeset = Project.changeset(%Project{}, params)

        case Repo.insert(changeset) do
          {:ok, project} ->
            send_json(conn, %{data: project_to_map(project)}, 201)

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
        projects =
          from(p in Project, where: p.client_id == ^user.id, order_by: [desc: p.inserted_at])
          |> Repo.all()
          |> Repo.preload(applications: :freelancer)

        send_json(conn, %{data: Enum.map(projects, &project_with_applications_to_map/1)})

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  post "/projects/:id/applications" do
    case authorize_roles(conn, [:freelancer]) do
      {:ok, user} ->
        case Repo.get(Project, conn.path_params["id"]) do
          nil ->
            json_error(conn, 404, "project not found")

          project ->
            params =
              conn.body_params
              |> Map.put("project_id", project.id)
              |> Map.put("freelancer_id", user.id)

            changeset = ProjectApplication.changeset(%ProjectApplication{}, params)

            case Repo.insert(changeset) do
              {:ok, application} ->
                application = Repo.preload(application, [:freelancer, :project])
                create_notification(project.client_id, %{
                  title: "새로운 지원이 들어왔습니다",
                  message: "#{user.name}님이 \"#{project.title}\" 프로젝트에 지원했습니다.",
                  type: "application",
                  ref_id: application.id
                })
                send_json(conn, %{data: application_to_map(application)}, 201)

              {:error, changeset} ->
                json_error(conn, 400, Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end))
            end
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  get "/freelancer/applications" do
    case authorize_roles(conn, [:freelancer]) do
      {:ok, user} ->
        applications =
          from(a in ProjectApplication, where: a.freelancer_id == ^user.id, order_by: [desc: a.inserted_at])
          |> Repo.all()
          |> Repo.preload([:project, :freelancer])

        send_json(conn, %{data: Enum.map(applications, &application_to_map/1)})

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  get "/logins" do
    logins =
      Repo.all(Login)
      |> Repo.preload(:user)
      |> Enum.map(&login_to_map/1)

    send_json(conn, %{data: logins})
  end

  get "/freelancer/services" do
    base = from(s in FreelancerService, where: s.is_active == true, order_by: [desc: s.inserted_at])

    base =
      case conn.query_params do
        %{"category" => cat} when cat != "" ->
          from(s in base, where: s.category == ^cat)

        _ ->
          base
      end

    base =
      case conn.query_params do
        %{"q" => q} when q != "" ->
          term = "%#{q}%"
          from(s in base, where: ilike(s.title, ^term) or ilike(s.description, ^term))
        _ -> base
      end

    services = Repo.all(base) |> Repo.preload(:freelancer)
    send_json(conn, %{data: Enum.map(services, &service_to_map/1)})
  end

  get "/freelancer/services/mine" do
    case authorize_roles(conn, [:freelancer]) do
      {:ok, user} ->
        services =
          from(s in FreelancerService,
            where: s.freelancer_id == ^user.id,
            order_by: [desc: s.inserted_at]
          )
          |> Repo.all()
          |> Repo.preload(:freelancer)

        send_json(conn, %{data: Enum.map(services, &service_to_map/1)})

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  post "/freelancer/services" do
    case authorize_roles(conn, [:freelancer]) do
      {:ok, user} ->
        params =
          conn.body_params
          |> Map.put("freelancer_id", user.id)

        changeset = FreelancerService.changeset(%FreelancerService{}, params)

        case Repo.insert(changeset) do
          {:ok, service} -> service = Repo.preload(service, :freelancer)
            send_json(conn, %{data: service_to_map(service)}, 201)

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
        case Repo.get(FreelancerService, conn.path_params["id"]) do
          nil ->
            json_error(conn, 404, "service not found")

          service when service.freelancer_id == user.id ->
            changeset = FreelancerService.changeset(service, conn.body_params)
            case Repo.update(changeset) do
              {:ok, updated} -> updated = Repo.preload(updated, :freelancer)
                send_json(conn, %{data: service_to_map(updated)})
              {:error, changeset} ->
                json_error(conn, 400, Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end))
            end

          _ ->
            json_error(conn, 403, "forbidden")
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  delete "/freelancer/services/:id" do
    case authorize_roles(conn, [:freelancer]) do
      {:ok, user} ->
        case Repo.get(FreelancerService, conn.path_params["id"]) do
          nil ->
            json_error(conn, 404, "service not found")

          service when service.freelancer_id == user.id ->
            case Repo.delete(service) do
              {:ok, _} -> send_json(conn, %{ok: true})
              {:error, changeset} ->
                json_error(conn, 400, Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end))
            end

          _ ->
            json_error(conn, 403, "forbidden")
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  post "/freelancer/services/:id/orders" do
    case authorize_roles(conn, [:client]) do
      {:ok, user} ->
        case Repo.get(FreelancerService, conn.path_params["id"]) do
          nil ->
            json_error(conn, 404, "service not found")

          service ->
            params =
              conn.body_params
              |> Map.put("service_id", service.id)
              |> Map.put("client_id", user.id)

            changeset = ServiceOrder.changeset(%ServiceOrder{}, params)
            case Repo.insert(changeset) do
              {:ok, order} ->
                order = Repo.preload(order, [:client, service: :freelancer])
                create_notification(service.freelancer_id, %{
                  title: "새로운 주문이 들어왔습니다",
                  message: "#{user.name}님이 \"#{service.title}\" 서비스를 주문했습니다.",
                  type: "order",
                  ref_id: order.id
                })
                send_json(conn, %{data: order_to_map(order)}, 201)

              {:error, changeset} ->
                json_error(conn, 400, Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end))
            end
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  get "/client/service-orders" do
    case authorize_roles(conn, [:client]) do
      {:ok, user} ->
        orders =
          from(o in ServiceOrder, where: o.client_id == ^user.id, order_by: [desc: o.inserted_at])
          |> Repo.all()
          |> Repo.preload([:client, service: :freelancer])

        send_json(conn, %{data: Enum.map(orders, &order_to_map/1)})

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  get "/freelancer/service-orders" do
    case authorize_roles(conn, [:freelancer]) do
      {:ok, user} ->
        orders =
          from(o in ServiceOrder,
            join: s in FreelancerService,
            on: o.service_id == s.id,
            where: s.freelancer_id == ^user.id,
            order_by: [desc: o.inserted_at]
          )
          |> Repo.all()
          |> Repo.preload([:client, service: :freelancer])

        send_json(conn, %{data: Enum.map(orders, &order_to_map/1)})

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

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
            from(p in Project, order_by: [desc: p.inserted_at], limit: 50)
            |> Repo.all()

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
                            Map.put(rec, "project", if(project, do: project_to_map(project), else: nil))
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
              err = case Jason.decode(body) do
                {:ok, %{"error" => %{"message" => m}}} -> m
                _ -> "HTTP #{status}"
              end
              json_error(conn, 502, "OpenAI 요청 실패: #{err}")

            {:error, reason} ->
              require Logger
              Logger.error("Finch error: #{inspect(reason)}")
              json_error(conn, 502, "AI 서버에 연결할 수 없습니다.")
          end
        end

      _ ->
        json_error(conn, 400, "prompt must be a non-empty string")
    end
  end

  get "/notifications" do
    case current_user(conn) do
      {:ok, user} ->
        notifications =
          from(n in Notification, where: n.user_id == ^user.id, order_by: [desc: n.inserted_at], limit: 50)
          |> Repo.all()

        send_json(conn, %{data: Enum.map(notifications, &notification_to_map/1)})

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  patch "/notifications/:id/read" do
    case current_user(conn) do
      {:ok, user} ->
        case Repo.get(Notification, conn.path_params["id"]) do
          nil ->
            json_error(conn, 404, "notification not found")

          notification when notification.user_id == user.id ->
            notification
            |> Notification.changeset(%{is_read: true})
            |> Repo.update()

            send_json(conn, %{ok: true})

          _ ->
            json_error(conn, 403, "forbidden")
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  patch "/notifications/read-all" do
    case current_user(conn) do
      {:ok, user} ->
        from(n in Notification, where: n.user_id == ^user.id and n.is_read == false)
        |> Repo.update_all(set: [is_read: true])

        send_json(conn, %{ok: true})

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  delete "/notifications/:id" do
    case current_user(conn) do
      {:ok, user} ->
        case Repo.get(Notification, conn.path_params["id"]) do
          nil ->
            json_error(conn, 404, "notification not found")

          notification when notification.user_id == user.id ->
            Repo.delete(notification)
            send_json(conn, %{ok: true})

          _ ->
            json_error(conn, 403, "forbidden")
        end

      {:error, status, message} ->
        json_error(conn, status, message)
    end
  end

  match _ do
    send_resp(conn, 404, "not found")
  end

  defp handle_signup(conn) do
    params =
      conn.body_params
      |> Map.put("account_type", Map.get(conn.body_params, "account_type") || Map.get(conn.body_params, "role"))
      |> Map.drop(["role"])

    changeset = User.registration_changeset(%User{}, params)

    case Repo.insert(changeset) do
      {:ok, user} ->
        {:ok, token, _claims} = SiteBackend.Auth.generate_jwt(%{user_id: user.id})

        send_json(
          conn,
          %{
            token: token,
            user: user_to_map(user)
          },
          201
        )

      {:error, changeset} ->
        json_error(conn, 400, Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end))
    end
  end

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
         user_id when is_binary(user_id) <- Map.get(claims, "user_id") || Map.get(claims, :user_id),
         user when not is_nil(user) <- Repo.get(User, user_id) do
      {:ok, user}
    else
      reason ->
        require Logger
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

  defp project_to_map(project) do
    %{
      id: project.id,
      title: project.title,
      description: project.description,
      skills: project.skills,
      budget: project.budget,
      client_name: project.client_name,
      client_id: project.client_id,
      inserted_at: format_datetime(project.inserted_at),
      updated_at: format_datetime(project.updated_at)
    }
  end

  defp project_with_applications_to_map(project) do
    Map.put(project_to_map(project), :applications, Enum.map(project.applications, &application_to_map/1))
  end

  defp application_to_map(application) do
    base = %{
      id: application.id,
      project_id: application.project_id,
      freelancer_id: application.freelancer_id,
      message: application.message,
      status: Atom.to_string(application.status),
      freelancer: user_to_map(application.freelancer),
      inserted_at: format_datetime(application.inserted_at),
      updated_at: format_datetime(application.updated_at)
    }

    case application.project do
      %SiteBackend.Project{} = p -> Map.put(base, :project, %{id: p.id, title: p.title})
      _ -> base
    end
  end

  defp user_to_map(user) do
    %{
      id: user.id,
      email: user.email,
      name: user.name,
      account_type: Atom.to_string(user.account_type)
    }
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

  defp service_to_map(service) do
    %{
      id: service.id,
      freelancer_id: service.freelancer_id,
      title: service.title,
      description: service.description,
      category: service.category,
      skills: service.skills || [],
      price: service.price,
      delivery_days: service.delivery_days,
      thumbnail_url: service.thumbnail_url,
      is_active: service.is_active,
      inserted_at: format_datetime(service.inserted_at),
      updated_at: format_datetime(service.updated_at),
      freelancer:
        if(service.freelancer, do: user_to_map(service.freelancer), else: nil)
    }
  end

  defp order_to_map(order) do
    %{
      id: order.id,
      service_id: order.service_id,
      client_id: order.client_id,
      requirements: order.requirements,
      status: Atom.to_string(order.status),
      inserted_at: format_datetime(order.inserted_at),
      updated_at: format_datetime(order.updated_at),
      service: service_to_map(order.service),
      client: if(order.client, do: user_to_map(order.client), else: nil)
    }
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

  defp create_notification(user_id, attrs) do
    %Notification{}
    |> Notification.changeset(Map.put(attrs, :user_id, user_id))
    |> Repo.insert()
    |> case do
      {:ok, _} -> :ok
      {:error, _} -> :ok
    end
  end

  defp notification_to_map(notification) do
    %{
      id: notification.id,
      user_id: notification.user_id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      ref_id: notification.ref_id,
      is_read: notification.is_read,
      inserted_at: format_datetime(notification.inserted_at),
      updated_at: format_datetime(notification.updated_at)
    }
  end
end

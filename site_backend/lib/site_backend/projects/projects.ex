defmodule SiteBackend.Projects do
  @moduledoc """
  프로젝트 관리 컨텍스트.
  """

  import Ecto.Query
  alias Ecto.Multi
  alias SiteBackend.Repo
  alias SiteBackend.Project
  alias SiteBackend.ProjectApplication
  alias SiteBackend.ProjectMember
  alias SiteBackend.User

  @cache_ttl_ms 30_000

  def list_projects do
    SiteBackend.Cache.fetch("projects:list:all", fn ->
      from(p in Project, order_by: [desc: p.inserted_at])
      |> Repo.all()
      |> Enum.map(&project_to_map/1)
    end, ttl: @cache_ttl_ms)
  end

  def get_project(project_id) do
    case Repo.get(Project, project_id) do
      nil ->
        {:error, :not_found}

      project ->
        project =
          project
          |> Repo.preload([applications: :freelancer, members: :user])

        {:ok, project_detail_to_map(project)}
    end
  end

  def list_client_projects(user_id) do
    from(p in Project, where: p.client_id == ^user_id, order_by: [desc: p.inserted_at])
    |> Repo.all()
    |> Repo.preload(applications: :freelancer, members: :user)
    |> Enum.map(&project_with_applications_to_map/1)
  end

  def list_project_members(project_id, user_id) do
    with {:ok, project} <- fetch_project_for_member(project_id, user_id) do
      members =
        from(m in ProjectMember, where: m.project_id == ^project.id, order_by: [asc: m.joined_at])
        |> Repo.all()
        |> Repo.preload(:user)
        |> Enum.map(&member_to_map/1)

      {:ok, members}
    end
  end

  def create_project(attrs) do
    case %Project{}
         |> Project.changeset(attrs)
         |> Repo.insert() do
      {:ok, project} ->
        invalidate_project_caches()
        {:ok, project}

      other ->
        other
    end
  end

  def apply_to_project(project_id, freelancer_id, message, proposed_role \\ nil) do
    case Repo.get(Project, project_id) do
      nil ->
        {:error, :not_found}

      %{status: status} when status not in [:recruiting] ->
        {:error, :not_recruiting}

      project ->
        params = %{
          project_id: project.id,
          freelancer_id: freelancer_id,
          message: message,
          proposed_role: proposed_role,
          source: :apply
        }

        changeset = ProjectApplication.changeset(%ProjectApplication{}, params)

        case Repo.insert(changeset) do
          {:ok, application} ->
            application = Repo.preload(application, [:freelancer, :project])
            _ = SiteBackend.Cache.delete("freelancer:applications:#{freelancer_id}")

            SiteBackend.Jobs.enqueue(:send_notification, %{
              user_id: project.client_id,
              title: "새로운 지원이 들어왔습니다",
              message:
                "#{application.freelancer.name}님이 \"#{application.project.title}\" 프로젝트에 지원했습니다.",
              type: "application",
              ref_id: application.id
            })

            {:ok, application}

          {:error, changeset} ->
            {:error, changeset}
        end
    end
  end

  def invite_freelancer(project_id, client_id, freelancer_id, message, proposed_role \\ nil) do
    with {:ok, project} <- fetch_owned_project(project_id, client_id),
         :ok <- ensure_recruiting(project),
         %User{account_type: :freelancer} <- Repo.get(User, freelancer_id) || {:error, :not_found} do
      params = %{
        project_id: project.id,
        freelancer_id: freelancer_id,
        message: message,
        proposed_role: proposed_role,
        source: :invite
      }

      case Repo.insert(ProjectApplication.changeset(%ProjectApplication{}, params)) do
        {:ok, application} ->
          application = Repo.preload(application, [:freelancer, :project])
          _ = SiteBackend.Cache.delete("freelancer:invitations:#{freelancer_id}")

          SiteBackend.Jobs.enqueue(:send_notification, %{
            user_id: freelancer_id,
            title: "프로젝트 초대가 도착했습니다",
            message:
              "#{project.client_name || "클라이언트"}님이 \"#{project.title}\" 프로젝트에 초대했습니다.",
            type: "invitation",
            ref_id: application.id
          })

          {:ok, application}

        {:error, changeset} ->
          {:error, changeset}
      end
    else
      {:error, _} = err -> err
      _ -> {:error, :not_found}
    end
  end

  def review_application(project_id, client_id, application_id, action, role \\ nil) do
    with {:ok, project} <- fetch_owned_project(project_id, client_id),
         {:ok, application} <- fetch_application(application_id, project.id),
         :ok <- ensure_apply_source(application),
         :ok <- ensure_pending(application) do
      case action do
        "accept" -> accept_application(project, application, role || application.proposed_role)
        "reject" -> reject_application(project, application)
        _ -> {:error, :invalid_action}
      end
    else
      {:error, _} = err -> err
    end
  end

  def respond_to_invitation(project_id, freelancer_id, application_id, action) do
    with {:ok, application} <- fetch_invitation(application_id, project_id, freelancer_id),
         :ok <- ensure_pending(application),
         project when not is_nil(project) <- Repo.get(Project, project_id) do
      case action do
        "accept" -> accept_application(project, application, application.proposed_role)
        "reject" -> reject_application(project, application, "invitation_rejected")
        _ -> {:error, :invalid_action}
      end
    else
      {:error, _} = err -> err
      nil -> {:error, :not_found}
    end
  end

  def list_freelancer_applications(freelancer_id) do
    from(a in ProjectApplication,
      where: a.freelancer_id == ^freelancer_id and a.source == ^:apply,
      order_by: [desc: a.inserted_at]
    )
    |> Repo.all()
    |> Repo.preload([:project, :freelancer])
    |> Enum.map(&application_to_map/1)
  end

  def list_freelancer_invitations(freelancer_id) do
    from(a in ProjectApplication,
      where: a.freelancer_id == ^freelancer_id and a.source == ^:invite,
      order_by: [desc: a.inserted_at]
    )
    |> Repo.all()
    |> Repo.preload([:project, :freelancer])
    |> Enum.map(&application_to_map/1)
  end

  defp accept_application(project, application, role) do
    role = role || "member"
    now = NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)

    Multi.new()
    |> Multi.update(:application, ProjectApplication.changeset(application, %{status: :accepted}))
    |> Multi.insert(
      :member,
      ProjectMember.changeset(%ProjectMember{}, %{
        project_id: project.id,
        user_id: application.freelancer_id,
        role: role,
        application_id: application.id,
        joined_at: now
      }),
      on_conflict: {:replace, [:role, :application_id, :updated_at]},
      conflict_target: [:project_id, :user_id]
    )
    |> Multi.run(:group_chat, fn _repo, _changes ->
      SiteBackend.Chat.ensure_project_group_room(project, application.freelancer_id)
    end)
    |> Multi.run(:project_status, fn repo, _changes ->
      attrs = %{status: :in_progress}

      project
      |> Project.changeset(attrs)
      |> repo.update()
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{application: updated_app, group_chat: _room}} ->
        invalidate_project_caches()
        _ = SiteBackend.Cache.delete("freelancer:applications:#{application.freelancer_id}")
        _ = SiteBackend.Cache.delete("freelancer:invitations:#{application.freelancer_id}")

        updated_app = Repo.preload(updated_app, [:freelancer, :project])

        notify_acceptance(project, updated_app, role)

        {:ok, updated_app}

      {:error, :member, %Ecto.Changeset{}, _} ->
        {:error, :already_member}

      {:error, _step, reason, _} ->
        {:error, reason}
    end
  end

  defp reject_application(project, application, notification_type \\ "application_rejected") do
    case application
         |> ProjectApplication.changeset(%{status: :rejected})
         |> Repo.update() do
      {:ok, updated} ->
        updated = Repo.preload(updated, [:freelancer, :project])
        _ = SiteBackend.Cache.delete("freelancer:applications:#{application.freelancer_id}")
        _ = SiteBackend.Cache.delete("freelancer:invitations:#{application.freelancer_id}")

        SiteBackend.Jobs.enqueue(:send_notification, %{
          user_id: application.freelancer_id,
          title: rejection_title(notification_type),
          message:
            "\"#{project.title}\" 프로젝트 #{rejection_label(notification_type)}되었습니다.",
          type: notification_type,
          ref_id: application.id
        })

        {:ok, updated}

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  defp notify_acceptance(project, application, role) do
    if application.source == :invite do
      SiteBackend.Jobs.enqueue(:send_notification, %{
        user_id: project.client_id,
        title: "초대가 수락되었습니다",
        message:
          "#{application.freelancer.name}님이 \"#{project.title}\" 프로젝트 초대를 수락했습니다. (#{role_label(role)})",
        type: "invitation_accepted",
        ref_id: application.id
      })
    else
      SiteBackend.Jobs.enqueue(:send_notification, %{
        user_id: application.freelancer_id,
        title: "지원이 수락되었습니다",
        message:
          "\"#{project.title}\" 프로젝트 지원이 수락되었습니다. (#{role_label(role)}) 팀 채팅방에 참여하세요.",
        type: "application_accepted",
        ref_id: application.id
      })
    end

    SiteBackend.Jobs.enqueue(:send_notification, %{
      user_id: application.freelancer_id,
      title: "팀 채팅에 참여했습니다",
      message: "\"#{project.title}\" 프로젝트 팀 채팅방에 추가되었습니다.",
      type: "team_joined",
      ref_id: project.id
    })
  end

  defp fetch_owned_project(project_id, client_id) do
    case Repo.get(Project, project_id) do
      nil -> {:error, :not_found}
      %{client_id: ^client_id} = project -> {:ok, project}
      _ -> {:error, :forbidden}
    end
  end

  defp fetch_project_for_member(project_id, user_id) do
    case Repo.get(Project, project_id) do
      nil ->
        {:error, :not_found}

      %{client_id: ^user_id} = project ->
        {:ok, project}

      project ->
        member? =
          from(m in ProjectMember, where: m.project_id == ^project.id and m.user_id == ^user_id)
          |> Repo.exists?()

        if member?, do: {:ok, project}, else: {:error, :forbidden}
    end
  end

  defp fetch_application(application_id, project_id) do
    case Repo.get(ProjectApplication, application_id) do
      nil -> {:error, :not_found}
      %{project_id: ^project_id} = app -> {:ok, app}
      _ -> {:error, :not_found}
    end
  end

  defp fetch_invitation(application_id, project_id, freelancer_id) do
    case Repo.get(ProjectApplication, application_id) do
      nil ->
        {:error, :not_found}

      %{project_id: ^project_id, freelancer_id: ^freelancer_id, source: :invite} = app ->
        {:ok, app}

      _ ->
        {:error, :not_found}
    end
  end

  defp ensure_recruiting(%{status: :recruiting}), do: :ok
  defp ensure_recruiting(_), do: {:error, :not_recruiting}

  defp ensure_apply_source(%{source: :apply}), do: :ok
  defp ensure_apply_source(_), do: {:error, :invalid_source}

  defp ensure_pending(%{status: :pending}), do: :ok
  defp ensure_pending(_), do: {:error, :already_reviewed}

  def project_to_map(project) do
    %{
      id: project.id,
      title: project.title,
      description: project.description,
      skills: project.skills,
      budget: project.budget,
      client_name: project.client_name,
      client_id: project.client_id,
      status: Atom.to_string(project.status || :recruiting),
      group_chat_room_id: Map.get(project, :group_chat_room_id),
      inserted_at: format_datetime(project.inserted_at),
      updated_at: format_datetime(project.updated_at)
    }
  end

  def project_detail_to_map(project) do
    project
    |> project_to_map()
    |> Map.put(:applications, Enum.map(project.applications || [], &application_to_map/1))
    |> Map.put(:members, Enum.map(project.members || [], &member_to_map/1))
  end

  def project_with_applications_to_map(project) do
    Map.put(project_detail_to_map(project), :members, Enum.map(project.members || [], &member_to_map/1))
  end

  def application_to_map(application) do
    base = %{
      id: application.id,
      project_id: application.project_id,
      freelancer_id: application.freelancer_id,
      message: application.message,
      proposed_role: application.proposed_role,
      source: Atom.to_string(application.source || :apply),
      status: Atom.to_string(application.status),
      freelancer: user_to_map(application.freelancer),
      inserted_at: format_datetime(application.inserted_at),
      updated_at: format_datetime(application.updated_at)
    }

    case application.project do
      %Project{} = p -> Map.put(base, :project, %{id: p.id, title: p.title, status: Atom.to_string(p.status || :recruiting)})
      _ -> base
    end
  end

  def member_to_map(member) do
    %{
      id: member.id,
      project_id: member.project_id,
      user_id: member.user_id,
      role: member.role,
      user: if(member.user, do: user_to_map(member.user), else: nil),
      joined_at: format_datetime(member.joined_at)
    }
  end

  defp user_to_map(user) do
    %{
      id: user.id,
      email: user.email,
      name: user.name,
      account_type: Atom.to_string(user.account_type)
    }
  end

  defp role_label(role) do
    case role do
      "designer" -> "디자이너"
      "developer" -> "개발자"
      "pm" -> "PM"
      _ -> role || "멤버"
    end
  end

  defp rejection_title("invitation_rejected"), do: "초대가 거절되었습니다"
  defp rejection_title(_), do: "지원이 거절되었습니다"

  defp rejection_label("invitation_rejected"), do: "초대 거절"
  defp rejection_label(_), do: "지원 거절"

  defp format_datetime(nil), do: nil
  defp format_datetime(datetime), do: NaiveDateTime.to_iso8601(datetime)

  defp invalidate_project_caches do
    _ = SiteBackend.Cache.invalidate_pattern("projects:list:*")
    :ok
  end
end

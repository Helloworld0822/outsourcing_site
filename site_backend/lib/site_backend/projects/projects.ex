defmodule SiteBackend.Projects do
  @moduledoc """
  프로젝트 관리 컨텍스트.
  """

  import Ecto.Query
  alias SiteBackend.Repo
  alias SiteBackend.Project
  alias SiteBackend.ProjectApplication
  alias SiteBackend.User

  @cache_ttl_ms 30_000

  def list_projects do
    SiteBackend.Cache.fetch("projects:list:all", fn ->
      from(p in Project, order_by: [desc: p.inserted_at])
      |> Repo.all()
      |> Enum.map(&project_to_map/1)
    end, ttl: @cache_ttl_ms)
  end

  def list_client_projects(user_id) do
    from(p in Project, where: p.client_id == ^user_id, order_by: [desc: p.inserted_at])
    |> Repo.all()
    |> Repo.preload(applications: :freelancer)
    |> Enum.map(&project_with_applications_to_map/1)
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

  def apply_to_project(project_id, freelancer_id, message) do
    case Repo.get(Project, project_id) do
      nil ->
        {:error, :not_found}

      project ->
        params = %{
          project_id: project.id,
          freelancer_id: freelancer_id,
          message: message
        }

        changeset = ProjectApplication.changeset(%ProjectApplication{}, params)

        case Repo.insert(changeset) do
          {:ok, application} ->
            # Preload the freelancer and project in a single query so we
            # can build the notification without an extra Repo.get.
            application = Repo.preload(application, [:freelancer, :project])

            # Invalidate the freelancer-applications list cache so the
            # freelancer sees their new application immediately.
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

  def list_freelancer_applications(freelancer_id) do
    from(a in ProjectApplication, where: a.freelancer_id == ^freelancer_id, order_by: [desc: a.inserted_at])
    |> Repo.all()
    |> Repo.preload([:project, :freelancer])
    |> Enum.map(&application_to_map/1)
  end

  def project_to_map(project) do
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

  def project_with_applications_to_map(project) do
    Map.put(project_to_map(project), :applications, Enum.map(project.applications, &application_to_map/1))
  end

  def application_to_map(application) do
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

  defp format_datetime(nil), do: nil
  defp format_datetime(datetime), do: NaiveDateTime.to_iso8601(datetime)

  defp invalidate_project_caches do
    _ = SiteBackend.Cache.invalidate_pattern("projects:list:*")
    :ok
  end
end

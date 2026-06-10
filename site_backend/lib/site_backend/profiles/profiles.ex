defmodule SiteBackend.Profiles do
  @moduledoc """
  사용자 프로필 관리 컨텍스트.
  """

  import Ecto.Query
  alias SiteBackend.Repo
  alias SiteBackend.UserProfile
  alias SiteBackend.User

  # ── Public API ──────────────────────────────────────────────────────────

  @doc """
  특정 사용자의 프로필을 조회합니다. 없으면 빈 프로필을 반환합니다.
  """
  def get_profile(user_id) do
    case Repo.get_by(UserProfile, user_id: user_id) do
      nil ->
        user = Repo.get(User, user_id)
        if user, do: {:ok, empty_profile(user)}, else: {:error, :not_found}

      profile ->
        profile = Repo.preload(profile, :user)
        {:ok, profile_to_map(profile)}
    end
  end

  @doc """
  사용자 ID로 공개 프로필을 조회합니다.
  """
  def get_public_profile(user_id) do
    case Repo.get_by(UserProfile, user_id: user_id) do
      nil ->
        user = Repo.get(User, user_id)

        cond do
          is_nil(user) -> {:error, :not_found}
          true -> {:ok, empty_profile(user)}
        end

      profile ->
        if profile.is_public do
          profile = Repo.preload(profile, :user)
          {:ok, profile_to_map(profile)}
        else
          {:error, :forbidden}
        end
    end
  end

  @doc """
  프로필을 생성하거나 업데이트합니다 (upsert).
  """
  def upsert_profile(user_id, attrs) do
    case Repo.get_by(UserProfile, user_id: user_id) do
      nil ->
        %UserProfile{}
        |> UserProfile.changeset(Map.put(attrs, "user_id", user_id))
        |> Repo.insert()
        |> case do
          {:ok, profile} ->
            profile = Repo.preload(profile, :user)
            {:ok, profile_to_map(profile)}

          {:error, changeset} ->
            {:error, changeset}
        end

      profile ->
        profile
        |> UserProfile.changeset(attrs)
        |> Repo.update()
        |> case do
          {:ok, updated} ->
            updated = Repo.preload(updated, :user)
            {:ok, profile_to_map(updated)}

          {:error, changeset} ->
            {:error, changeset}
        end
    end
  end

  @doc """
  프리랜서 프로필 목록을 조회합니다 (공개 프로필만).
  """
  def list_freelancer_profiles(query_params \\ %{}) do
    base =
      from(p in UserProfile,
        join: u in User,
        on: p.user_id == u.id,
        where: u.account_type == :freelancer and p.is_public == true,
        order_by: [desc: p.updated_at],
        preload: [:user]
      )

    base =
      case query_params do
        %{"q" => q} when q != "" ->
          term = "%#{q}%"

          from(p in base,
            where: ilike(p.bio, ^term) or ilike(p.location, ^term)
          )

        _ ->
          base
      end

    base =
      case query_params do
        %{"skill" => skill} when skill != "" ->
          from(p in base, where: ^skill in p.skills)

        _ ->
          base
      end

    base
    |> Repo.all()
    |> Enum.map(&profile_to_map/1)
  end

  # ── Private Helpers ─────────────────────────────────────────────────────

  def profile_to_map(%UserProfile{} = profile) do
    user = profile.user

    %{
      id: profile.id,
      user_id: profile.user_id,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
      location: profile.location,
      website_url: profile.website_url,
      github_url: profile.github_url,
      skills: profile.skills || [],
      hourly_rate: profile.hourly_rate,
      experience_years: profile.experience_years,
      portfolio_items: profile.portfolio_items || [],
      is_public: profile.is_public,
      inserted_at: format_datetime(profile.inserted_at),
      updated_at: format_datetime(profile.updated_at),
      user:
        if user do
          %{
            id: user.id,
            name: user.name,
            email: user.email,
            account_type: Atom.to_string(user.account_type)
          }
        end
    }
  end

  def profile_to_map(map) when is_map(map), do: map

  defp empty_profile(user) do
    %{
      id: nil,
      user_id: user.id,
      bio: nil,
      avatar_url: nil,
      location: nil,
      website_url: nil,
      github_url: nil,
      skills: [],
      hourly_rate: nil,
      experience_years: nil,
      portfolio_items: [],
      is_public: true,
      inserted_at: nil,
      updated_at: nil,
      user: %{
        id: user.id,
        name: user.name,
        email: user.email,
        account_type: Atom.to_string(user.account_type)
      }
    }
  end

  defp format_datetime(nil), do: nil
  defp format_datetime(datetime), do: NaiveDateTime.to_iso8601(datetime)
end

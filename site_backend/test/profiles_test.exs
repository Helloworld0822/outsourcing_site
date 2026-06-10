defmodule SiteBackend.ProfilesTest do
  use ExUnit.Case, async: false

  import Ecto.Query
  alias SiteBackend.Repo
  alias SiteBackend.User
  alias SiteBackend.UserProfile
  alias SiteBackend.Profiles

  setup do
    unique_num = System.unique_integer([:positive])
    email = "test-freelancer-#{unique_num}@example.com"
    name = "Test Freelancer #{unique_num}"

    # Create a freelancer user
    {:ok, user} =
      %User{}
      |> User.registration_changeset(%{
        email: email,
        password: "Password123",
        name: name,
        account_type: :freelancer
      })
      |> Repo.insert()

    on_exit(fn ->
      # Clean up
      Repo.delete_all(from(p in UserProfile, where: p.user_id == ^user.id))
      Repo.delete(user)
    end)

    %{user: user}
  end

  test "upsert_profile/2 and get_profile/1 flow", %{user: user} do
    # Get profile initially - should return empty profile
    {:ok, empty_prof} = Profiles.get_profile(user.id)
    assert empty_prof.id == nil
    assert empty_prof.user_id == user.id
    assert empty_prof.bio == nil

    # Upsert profile
    attrs = %{
      "bio" => "안녕하세요, Elixir 개발자입니다.",
      "skills" => ["Elixir", "Phoenix", "PostgreSQL"],
      "location" => "Seoul",
      "experience_years" => 3,
      "hourly_rate" => "30,000원",
      "is_public" => true
    }

    {:ok, profile} = Profiles.upsert_profile(user.id, attrs)
    assert profile.id != nil
    assert profile.bio == "안녕하세요, Elixir 개발자입니다."
    assert profile.skills == ["Elixir", "Phoenix", "PostgreSQL"]
    assert profile.location == "Seoul"
    assert profile.experience_years == 3

    # Retrieve profile again
    {:ok, retrieved} = Profiles.get_profile(user.id)
    assert retrieved.id == profile.id
    assert retrieved.bio == "안녕하세요, Elixir 개발자입니다."

    # Update profile (upsert again)
    updated_attrs = %{"bio" => "업데이트된 바이오"}
    {:ok, updated_prof} = Profiles.upsert_profile(user.id, updated_attrs)
    assert updated_prof.id == profile.id
    assert updated_prof.bio == "업데이트된 바이오"
  end

  test "get_public_profile/1 handles visibility properly", %{user: user} do
    # Create profile
    {:ok, _profile} = Profiles.upsert_profile(user.id, %{
      "bio" => "공개 프로필 내용",
      "is_public" => false
    })

    # Since it is private, get_public_profile should return forbidden
    assert {:error, :forbidden} = Profiles.get_public_profile(user.id)

    # Change to public
    {:ok, _profile} = Profiles.upsert_profile(user.id, %{"is_public" => true})
    {:ok, pub_prof} = Profiles.get_public_profile(user.id)
    assert pub_prof.bio == "공개 프로필 내용"
  end

  test "list_freelancer_profiles/1 returns public freelancers", %{user: user} do
    # Make user public freelancer
    {:ok, _profile} = Profiles.upsert_profile(user.id, %{
      "bio" => "프리랜서 바이오",
      "skills" => ["Rust", "Go"],
      "is_public" => true
    })

    # Search without query
    profiles = Profiles.list_freelancer_profiles(%{})
    assert Enum.any?(profiles, fn p -> p.user_id == user.id end)

    # Search by skill
    rust_profiles = Profiles.list_freelancer_profiles(%{"skill" => "Rust"})
    assert Enum.any?(rust_profiles, fn p -> p.user_id == user.id end)

    elixir_profiles = Profiles.list_freelancer_profiles(%{"skill" => "Elixir"})
    refute Enum.any?(elixir_profiles, fn p -> p.user_id == user.id end)

    # Search by term
    term_profiles = Profiles.list_freelancer_profiles(%{"q" => "프리랜서"})
    assert Enum.any?(term_profiles, fn p -> p.user_id == user.id end)

    other_term_profiles = Profiles.list_freelancer_profiles(%{"q" => "없는단어"})
    refute Enum.any?(other_term_profiles, fn p -> p.user_id == user.id end)
  end
end

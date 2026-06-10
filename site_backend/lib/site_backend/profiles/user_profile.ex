defmodule SiteBackend.UserProfile do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "user_profiles" do
    belongs_to :user, SiteBackend.User, type: :binary_id

    field :bio, :string
    field :avatar_url, :string
    field :location, :string
    field :website_url, :string
    field :github_url, :string
    field :skills, {:array, :string}, default: []
    field :hourly_rate, :string
    field :experience_years, :integer
    field :portfolio_items, {:array, :map}, default: []
    field :is_public, :boolean, default: true

    timestamps()
  end

  def changeset(struct, params) do
    struct
    |> cast(params, [
      :user_id,
      :bio,
      :avatar_url,
      :location,
      :website_url,
      :github_url,
      :skills,
      :hourly_rate,
      :experience_years,
      :portfolio_items,
      :is_public
    ])
    |> validate_required([:user_id])
    |> validate_length(:bio, max: 1000, message: "소개는 최대 1000자까지 입력할 수 있습니다.")
    |> validate_length(:location, max: 100, message: "위치는 최대 100자까지 입력할 수 있습니다.")
    |> validate_number(:experience_years, greater_than_or_equal_to: 0, less_than_or_equal_to: 50,
      message: "경력은 0~50년 사이로 입력해주세요.")
    |> unique_constraint(:user_id)
    |> foreign_key_constraint(:user_id)
  end
end

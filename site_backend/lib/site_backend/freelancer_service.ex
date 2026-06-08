defmodule SiteBackend.FreelancerService do
  use Ecto.Schema
  import Ecto.Changeset

  alias SiteBackend.{ServiceOrder, User}

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "freelancer_services" do
    field :title, :string
    field :description, :string
    field :category, :string
    field :skills, {:array, :string}, default: []
    field :price, :string
    field :delivery_days, :integer, default: 7
    field :thumbnail_url, :string
    field :is_active, :boolean, default: true
    belongs_to :freelancer, User, type: :binary_id
    has_many :orders, ServiceOrder, foreign_key: :service_id

    timestamps()
  end

  def changeset(service, params) do
    service
    |> cast(params, [
      :freelancer_id,
      :title,
      :description,
      :category,
      :skills,
      :price,
      :delivery_days,
      :thumbnail_url,
      :is_active
    ])
    |> validate_required([:freelancer_id, :title, :description, :category, :price])
    |> validate_number(:delivery_days, greater_than: 0)
  end
end

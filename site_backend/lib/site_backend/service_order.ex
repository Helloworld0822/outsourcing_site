defmodule SiteBackend.ServiceOrder do
  use Ecto.Schema
  import Ecto.Changeset

  alias SiteBackend.{FreelancerService, User}

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "service_orders" do
    field :requirements, :string
    field :status, Ecto.Enum, values: [:requested, :accepted, :rejected, :completed], default: :requested
    belongs_to :service, FreelancerService, type: :binary_id
    belongs_to :client, User, type: :binary_id

    timestamps()
  end

  def changeset(order, params) do
    order
    |> cast(params, [:service_id, :client_id, :requirements, :status])
    |> validate_required([:service_id, :client_id, :requirements])
    |> foreign_key_constraint(:service_id)
    |> foreign_key_constraint(:client_id)
  end
end

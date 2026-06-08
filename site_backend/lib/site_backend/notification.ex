defmodule SiteBackend.Notification do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  @timestamps_opts [type: :naive_datetime]

  schema "notifications" do
    field :title, :string
    field :message, :string
    field :type, :string
    field :ref_id, :binary_id
    field :is_read, :boolean, default: false

    belongs_to :user, SiteBackend.User

    timestamps()
  end

  def changeset(notification, attrs) do
    notification
    |> cast(attrs, [:user_id, :title, :message, :type, :ref_id, :is_read])
    |> validate_required([:user_id, :title, :message, :type])
  end
end

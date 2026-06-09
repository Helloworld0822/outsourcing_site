defmodule SiteBackend.User do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "users" do
    field :email, :string
    field :password, :string, virtual: true
    field :password_hash, :string
    field :name, :string
    field :account_type, Ecto.Enum, values: [:client, :freelancer]
    field :failed_login_count, :integer, default: 0
    field :locked_until, :naive_datetime
    field :email_verified, :boolean, default: false
    field :email_verification_token, :string
    field :email_verification_sent_at, :naive_datetime
    field :refresh_token_hash, :string
    field :refresh_token_expires_at, :naive_datetime
    has_many :logins, SiteBackend.Login

    timestamps()
  end

  @max_failed_logins 10
  @lockout_minutes 15
  @refresh_token_ttl_days 30

  def registration_changeset(struct, params) do
    struct
    |> cast(params, [:email, :password, :name, :account_type])
    |> validate_required([:email, :password, :name, :account_type])
    |> validate_format(:email, ~r/^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: "이메일 형식이 올바르지 않습니다"
    )
    |> validate_length(:password, min: 8,
      message: "비밀번호는 최소 8자 이상이어야 합니다"
    )
    |> validate_format(:password, ~r/[A-Za-z]/,
      message: "비밀번호에 영문이 포함되어야 합니다"
    )
    |> validate_format(:password, ~r/[0-9]/,
      message: "비밀번호에 숫자가 포함되어야 합니다"
    )
    |> validate_length(:name, min: 1, max: 50,
      message: "이름은 1~50자로 입력해주세요"
    )
    |> unique_constraint(:email)
    |> put_pass_hash()
  end

  def lockout_changeset(user) do
    now = NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
    locked_until = NaiveDateTime.add(now, @lockout_minutes * 60, :second) |> NaiveDateTime.truncate(:second)

    user
    |> change(%{
      failed_login_count: @max_failed_logins,
      locked_until: locked_until
    })
  end

  def increment_failed_login(user) do
    new_count = (user.failed_login_count || 0) + 1

    cond do
      new_count >= @max_failed_logins ->
        lockout_changeset(user)

      true ->
        change(user, %{failed_login_count: new_count})
    end
  end

  def reset_failed_logins(user) do
    change(user, %{failed_login_count: 0, locked_until: nil})
  end

  def locked?(%{locked_until: nil}), do: false
  def locked?(%{locked_until: locked_until}) do
    NaiveDateTime.compare(locked_until, NaiveDateTime.utc_now()) == :gt
  end

  def generate_verification_token do
    :crypto.strong_rand_bytes(32)
    |> Base.url_encode64(padding: false)
  end

  def set_verification_token(user) do
    token = generate_verification_token()
    now = NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)

    user
    |> change(%{
      email_verification_token: token,
      email_verification_sent_at: now
    })
  end

  def verify_email(user) do
    user
    |> change(%{email_verified: true})
  end

  def generate_refresh_token do
    :crypto.strong_rand_bytes(48)
    |> Base.url_encode64(padding: false)
  end

  def hash_refresh_token(token) when is_binary(token) do
    :crypto.hash(:sha256, token) |> Base.encode16(case: :lower)
  end

  def set_refresh_token(user, raw_token) do
    now = NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
    expires_at = NaiveDateTime.add(now, @refresh_token_ttl_days * 24 * 60 * 60, :second) |> NaiveDateTime.truncate(:second)

    user
    |> change(%{
      refresh_token_hash: hash_refresh_token(raw_token),
      refresh_token_expires_at: expires_at
    })
  end

  def clear_refresh_token(user) do
    user
    |> change(%{refresh_token_hash: nil, refresh_token_expires_at: nil})
  end

  def refresh_token_valid?(%{refresh_token_hash: nil}), do: false
  def refresh_token_valid?(%{refresh_token_expires_at: nil}), do: false
  def refresh_token_valid?(%{refresh_token_expires_at: expires_at}) do
    NaiveDateTime.compare(expires_at, NaiveDateTime.utc_now()) == :gt
  end

  defp put_pass_hash(changeset) do
    case get_change(changeset, :password) do
      nil -> changeset
      pass ->
        put_change(changeset, :password_hash, Bcrypt.hash_pwd_salt(pass))
        |> delete_change(:password)
    end
  end
end

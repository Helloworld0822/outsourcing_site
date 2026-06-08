defmodule SiteBackend.SecurityAudit do
  @moduledoc """
  Logs security-relevant events for audit purposes.
  """
  require Logger

  @doc """
  Log a security event. Events are written to the `:info` log level
  under the `[security]` tag for easy filtering.
  """
  def log_event(event, details \\ %{}) do
    Logger.info("[security] #{event}", details: details)
  end

  @doc """
  Log a failed login attempt.
  """
  def log_failed_login(email, ip) do
    log_event("login_failed", %{email: email, ip: ip})
  end

  @doc """
  Log a successful login.
  """
  def log_successful_login(user_id, email, ip) do
    log_event("login_success", %{user_id: user_id, email: email, ip: ip})
  end

  @doc """
  Log a successful signup.
  """
  def log_signup(user_id, email, ip) do
    log_event("signup_success", %{user_id: user_id, email: email, ip: ip})
  end

  @doc """
  Log a rate limit hit.
  """
  def log_rate_limit(key, path) do
    log_event("rate_limit_exceeded", %{key: key, path: path})
  end

  @doc """
  Log an account lockout.
  """
  def log_account_lockout(user_id, email, ip) do
    log_event("account_locked", %{user_id: user_id, email: email, ip: ip})
  end

  @doc """
  Log an email verification.
  """
  def log_email_verification(user_id, email) do
    log_event("email_verified", %{user_id: user_id, email: email})
  end

  @doc """
  Log an email verification request.
  """
  def log_email_verification_request(email, ip) do
    log_event("email_verification_requested", %{email: email, ip: ip})
  end
end

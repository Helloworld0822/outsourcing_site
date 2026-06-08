defmodule SiteBackend.Email do
  import Swoosh.Email

  def verification_email(email, token) do
    base_url = Application.get_env(:site_backend, :email_verification)[:base_url] || "http://localhost:5173"
    verification_url = "#{base_url}/verify-email?token=#{token}"

    new()
    |> to({email, email})
    |> from({"Outsourcing Hub", "noreply@outsourcing-hub.com"})
    |> subject("[Outsourcing Hub] 이메일 인증 요청")
    |> html_body(verification_html(verification_url))
    |> text_body(verification_text(verification_url))
  end

  defp verification_html(url) do
    """
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
        .content { background: #f9fafb; padding: 30px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; background: #2563eb; color: white !important; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 20px 0; }
        .button:hover { background: #1d4ed8; }
        .footer { text-align: center; padding: 20px 0; color: #6b7280; font-size: 14px; }
        .url-box { background: #e5e7eb; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Outsourcing Hub</div>
        </div>
        <div class="content">
          <h2 style="margin-top: 0;">이메일 인증</h2>
          <p>회원가입을 환영합니다!</p>
          <p>아래 버튼을 클릭하여 이메일 인증을 완료하세요.</p>
          <div style="text-align: center;">
            <a href="#{url}" class="button">이메일 인증하기</a>
          </div>
          <div class="url-box">
            <p style="margin: 0;">버튼이 작동하지 않으면 아래 URL을 복사하여 브라우저에 붙여넣으세요:</p>
            <p style="margin: 5px 0 0 0;">#{url}</p>
          </div>
        </div>
        <div class="footer">
          <p>이 메일을 요청하지 않으셨다면 무시해주세요.</p>
          <p>&copy; #{Date.utc_today().year} Outsourcing Hub</p>
        </div>
      </div>
    </body>
    </html>
    """
  end

  defp verification_text(url) do
    """
    [Outsourcing Hub] 이메일 인증

    회원가입을 환영합니다!

    아래 링크를 클릭하여 이메일 인증을 완료하세요:

    #{url}

    이 메일을 요청하지 않으셨다면 무시해주세요.
    """
  end
end

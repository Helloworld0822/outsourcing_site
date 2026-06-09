import { useState, type ChangeEvent } from 'react'
import { API_BASE } from './apiBase'
import { readJsonResponse, formatHttpError, setSession, type SessionUser, type Session } from './http'

type LoginPanelProps = {
  onLogin: (session: Session) => void
  onNeedVerification?: (email: string) => void
}

export default function LoginPanel({ onLogin, onNeedVerification }: LoginPanelProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isVerificationError, setIsVerificationError] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  async function submitLogin() {
    setLoading(true)
    setError(null)
    setIsVerificationError(false)
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const body = await readJsonResponse<{ error?: string; token?: string; refresh_token?: string; user?: SessionUser }>(res)
      if (!res.ok) {
        const retryAfter = res.headers.get('retry-after')
        const errorMsg = formatHttpError(res.status, retryAfter, body?.error)
        setError(errorMsg)
        if (res.status === 403 && body?.error?.includes('이메일 인증')) {
          setIsVerificationError(true)
        }
      } else {
        if (!body?.token || !body.refresh_token || !body.user) {
          setError('로그인 응답이 올바르지 않습니다.')
          return
        }
        const session: Session = { token: body.token, refresh_token: body.refresh_token, user: body.user }
        setSession(session)
        onLogin(session)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function resendVerification() {
    setResendLoading(true)
    setResendMessage(null)
    try {
      const res = await fetch(`${API_BASE}/api/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = await readJsonResponse<{ message?: string }>(res)
      if (!res.ok) {
        const retryAfter = res.headers.get('retry-after')
        setResendMessage(formatHttpError(res.status, retryAfter, body?.message))
      } else {
        setResendMessage(body?.message || '인증 메일이 재발송되었습니다.')
      }
    } catch {
      setResendMessage('메일 재발송에 실패했습니다.')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={() => {}}>
      <div className="modal-card" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: 28 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius)', background: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 18, marginBottom: 12 }}>O</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>로그인</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>계정에 로그인하세요</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="form-label">이메일</label>
              <input
                className="form-input"
                type="email"
                placeholder="이메일을 입력하세요"
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">비밀번호</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                    padding: '4px 6px',
                  }}
                >
                  {showPassword ? '숨기기' : '보기'}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: 14,
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: isVerificationError ? 'var(--info-light)' : 'var(--error-light)',
              border: `1px solid ${isVerificationError ? 'rgba(37, 99, 235, 0.15)' : 'rgba(220, 38, 38, 0.15)'}`,
              color: isVerificationError ? 'var(--info)' : 'var(--error)',
              fontSize: 13,
              lineHeight: 1.5,
            }}>
              {error}
              {isVerificationError && (
                <div style={{ marginTop: 8 }}>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={resendVerification}
                    disabled={resendLoading}
                  >
                    {resendLoading ? '발송 중...' : '인증 메일 재발송'}
                  </button>
                  {resendMessage && (
                    <p style={{ marginTop: 6, fontSize: 12, color: resendMessage.includes('발송') ? 'var(--success)' : 'var(--error)' }}>
                      {resendMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px 0', fontSize: 14 }}
              onClick={submitLogin}
              disabled={loading}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

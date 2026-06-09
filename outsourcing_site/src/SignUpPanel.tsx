import { useState, type ChangeEvent } from 'react'
import { API_BASE } from './apiBase'
import { readJsonResponse, formatHttpError } from './http'

export default function SignUpPanel({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<'client' | 'freelancer'>('client')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signupComplete, setSignupComplete] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  function validate() {
    if (!name.trim()) return '이름을 입력해주세요.'
    if (!email.includes('@')) return '유효한 이메일을 입력해주세요.'
    if (password.length < 8) return '비밀번호는 최소 8자 이상이어야 합니다.'
    if (!/[A-Za-z]/.test(password)) return '비밀번호에 영문이 포함되어야 합니다.'
    if (!/[0-9]/.test(password)) return '비밀번호에 숫자가 포함되어야 합니다.'
    if (password !== confirm) return '비밀번호와 확인이 일치하지 않습니다.'
    return null
  }

  async function submitSignUp() {
    const v = validate()
    if (v) {
      setError(v)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, account_type: accountType, email, password }),
      })
      const body = await readJsonResponse<{ error?: string; message?: string; email?: string }>(res)
      if (!res.ok) {
        const retryAfter = res.headers.get('retry-after')
        setError(formatHttpError(res.status, retryAfter, body?.error))
      } else {
        setSignupComplete(true)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '서버와 통신 중 오류가 발생했습니다.')
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

  if (signupComplete) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📧</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>이메일 인증이 필요합니다</h2>
            <p style={{ marginTop: 10, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
              <strong>{email}</strong>로 인증 메일을 발송했습니다.<br />
              메일함에서 인증 링크를 클릭하여 회원가입을 완료해주세요.
            </p>
            <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 12 }}>
              메일이 오지 않았나요? 스팸함을 확인하거나 아래 버튼을 눌러 재발송하세요.
            </p>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={resendVerification} disabled={resendLoading}>
                {resendLoading ? '발송 중...' : '인증 메일 재발송'}
              </button>
              {resendMessage && (
                <p style={{ fontSize: 12, color: resendMessage.includes('발송') ? 'var(--success)' : 'var(--error)' }}>
                  {resendMessage}
                </p>
              )}
              <button className="btn btn-ghost" onClick={onClose} style={{ marginTop: 4 }}>
                로그인 페이지로
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>회원가입</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>새 계정을 만드세요</p>
            </div>
            <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 13 }}>닫기</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="form-label">이름</label>
              <input className="form-input" placeholder="이름을 입력하세요" value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
            </div>
            <div>
              <label className="form-label">회원 유형</label>
              <select
                className="form-input"
                value={accountType}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setAccountType(e.target.value === 'freelancer' ? 'freelancer' : 'client')}
                style={{ padding: '8px 12px' }}
              >
                <option value="client">클라이언트</option>
                <option value="freelancer">프리랜서</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="form-label">이메일</label>
            <input className="form-input" type="email" placeholder="이메일을 입력하세요" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
            <div>
              <label className="form-label">비밀번호</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="8자 이상, 영문+숫자"
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '4px 6px' }}
                >
                  {showPassword ? '숨기기' : '보기'}
                </button>
              </div>
            </div>
            <div>
              <label className="form-label">비밀번호 확인</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="비밀번호를 다시 입력하세요"
                  value={confirm}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)}
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '4px 6px' }}
                >
                  {showConfirm ? '숨기기' : '보기'}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: 14,
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--error-light)',
              border: '1px solid rgba(220, 38, 38, 0.15)',
              color: 'var(--error)',
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: 'pre-line',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button className="btn btn-secondary" onClick={onClose}>취소</button>
            <button className="btn btn-primary" onClick={submitSignUp} disabled={loading}>
              {loading ? '가입 중...' : '가입하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

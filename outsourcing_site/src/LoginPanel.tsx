import { useState, type ChangeEvent } from 'react'
import { TextInput, Button, Heading } from '@primer/react'
import { EyeIcon, EyeClosedIcon } from '@primer/octicons-react'
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
    <div style={{border: '1px solid var(--border)', borderRadius: 12, padding: 16, width: 320, background: 'var(--surface)', boxShadow: 'var(--shadow)'}}>
      <Heading as="h3">로그인</Heading>
      <div style={{marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6}}>
        <label>이메일</label>
        <TextInput placeholder="이메일을 입력해주세요" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
      </div>
      <div style={{marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6}}>
        <label>비밀번호</label>
        <TextInput
          type={showPassword ? 'text' : 'password'}
          placeholder="비밀번호를 입력해주세요"
          value={password}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          trailingAction={
            <TextInput.Action
              onClick={() => setShowPassword(v => !v)}
              icon={showPassword ? EyeClosedIcon : EyeIcon}
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            />
          }
        />
      </div>
      {error && (
        <div style={{
          marginTop: 8,
          padding: '10px 14px',
          borderRadius: 8,
          background: isVerificationError ? 'rgba(59, 130, 246, 0.1)' : 'rgba(248, 81, 73, 0.1)',
          border: `1px solid ${isVerificationError ? 'rgba(59, 130, 246, 0.3)' : 'rgba(248, 81, 73, 0.3)'}`,
          color: isVerificationError ? '#2563eb' : '#cf222e',
          fontSize: 14,
          lineHeight: 1.5,
        }}>
          {error}
          {isVerificationError && (
            <div style={{marginTop: 8}}>
              <Button
                variant="default"
                size="small"
                onClick={resendVerification}
                disabled={resendLoading}
              >
                {resendLoading ? '발송 중...' : '인증 메일 재발송'}
              </Button>
              {resendMessage && (
                <p style={{marginTop: 6, fontSize: 12, color: resendMessage.includes('발송') ? '#10b981' : '#cf222e'}}>
                  {resendMessage}
                </p>
              )}
            </div>
          )}
        </div>
      )}
      <div style={{marginTop: 12}}>
        <Button variant="primary" onClick={submitLogin} disabled={loading}>{loading ? '로그인...' : '로그인'}</Button>
      </div>
    </div>
  )
}

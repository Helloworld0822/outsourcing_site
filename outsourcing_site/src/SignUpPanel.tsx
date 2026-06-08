import { useState, type ChangeEvent } from 'react'
import { TextInput, Button, Heading, Select } from '@primer/react'
import { EyeIcon, EyeClosedIcon } from '@primer/octicons-react'
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
      <div style={{position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--overlay)', zIndex: 9999, padding: 16}}>
        <div style={{background: 'var(--surface)', padding: 24, borderRadius: 16, width: 480, maxWidth: '100%', boxShadow: 'var(--shadow)', border: '1px solid var(--border)', textAlign: 'center'}}>
          <div style={{fontSize: 48, marginBottom: 16}}>📧</div>
          <Heading as="h3">이메일 인증이 필요합니다</Heading>
          <p style={{marginTop: 12, color: 'var(--fg-muted)', fontSize: 14, lineHeight: 1.6}}>
            <strong>{email}</strong>로 인증 메일을 발송했습니다.<br />
            메일함에서 인증 링크를 클릭하여 회원가입을 완료해주세요.
          </p>
          <p style={{marginTop: 8, color: 'var(--fg-muted)', fontSize: 13}}>
            메일이 오지 않았나요? 스팸함을 확인하거나 아래 버튼을 눌러 재발송하세요.
          </p>
          <div style={{marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center'}}>
            <Button variant="primary" onClick={resendVerification} disabled={resendLoading}>
              {resendLoading ? '발송 중...' : '인증 메일 재발송'}
            </Button>
            {resendMessage && (
              <p style={{fontSize: 13, color: resendMessage.includes('발송') ? '#10b981' : '#cf222e', marginTop: 4}}>
                {resendMessage}
              </p>
            )}
            <Button variant="default" onClick={onClose} style={{marginTop: 8}}>
              로그인 페이지로
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--overlay)', zIndex: 9999, padding: 16}}>
      <div style={{background: 'var(--surface)', padding: 20, borderRadius: 16, width: 480, maxWidth: '100%', boxShadow: 'var(--shadow)', border: '1px solid var(--border)'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <Heading as="h3">회원가입</Heading>
          <Button variant="invisible" onClick={onClose}>닫기</Button>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
            <label style={{fontSize: 14}}>이름</label>
            <TextInput placeholder="이름을 입력해주세요" value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
            <label style={{fontSize: 14}}>회원 유형</label>
            <Select onChange={(e: ChangeEvent<HTMLSelectElement>) => setAccountType(e.target.value === 'freelancer' ? 'freelancer' : 'client')} value={accountType}>
              <option value="client">클라이언트</option>
              <option value="freelancer">프리랜서</option>
            </Select>
          </div>

          <div style={{gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6}}>
            <label style={{fontSize: 14}}>이메일</label>
            <TextInput placeholder="이메일을 입력해주세요" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
            <label style={{fontSize: 14}}>비밀번호</label>
            <TextInput
              type={showPassword ? 'text' : 'password'}
              placeholder="8자 이상, 영문+숫자 포함"
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
          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
            <label style={{fontSize: 14}}>비밀번호 확인</label>
            <TextInput
              type={showConfirm ? 'text' : 'password'}
              placeholder="비밀번호를 다시 입력해주세요"
              value={confirm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)}
              trailingAction={
                <TextInput.Action
                  onClick={() => setShowConfirm(v => !v)}
                  icon={showConfirm ? EyeClosedIcon : EyeIcon}
                  aria-label={showConfirm ? '비밀번호 숨기기' : '비밀번호 보기'}
                />
              }
            />
          </div>
        </div>

        {error && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(248, 81, 73, 0.1)',
            border: '1px solid rgba(248, 81, 73, 0.3)',
            color: '#cf222e',
            fontSize: 14,
            lineHeight: 1.5,
            whiteSpace: 'pre-line',
          }}>
            {error}
          </div>
        )}

        <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16}}>
          <Button variant="default" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submitSignUp} disabled={loading}>{loading ? '가입 중...' : '가입하기'}</Button>
        </div>
      </div>
    </div>
  )
}

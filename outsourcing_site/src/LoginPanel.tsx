import { useState, type ChangeEvent } from 'react'
import { TextInput, Button, Heading, Text } from '@primer/react'
import { EyeIcon, EyeClosedIcon } from '@primer/octicons-react'
import { API_BASE } from './apiBase'
import { readJsonResponse, formatError } from './http'

type SessionUser = {
  id: string
  email: string
  name: string
  account_type: 'client' | 'freelancer'
}

export default function LoginPanel({ onLogin }: { onLogin: (session: { token: string; user: SessionUser }) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submitLogin() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const body = await readJsonResponse<{ error?: string; token?: string; user?: SessionUser }>(res)
      if (!res.ok) {
        setError(formatError(body?.error, '로그인 실패'))
      } else {
        if (!body?.token || !body.user) {
          setError('로그인 응답이 올바르지 않습니다.')
          return
        }
        localStorage.setItem('token', body.token)
        localStorage.setItem('user', JSON.stringify(body.user))
        onLogin({ token: body.token, user: body.user })
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
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
        <Text color="danger.fg" style={{marginTop: 8}}>{error}</Text>
      )}
      <div style={{marginTop: 12}}>
        <Button variant="primary" onClick={submitLogin} disabled={loading}>{loading ? '로그인...' : '로그인'}</Button>
      </div>
    </div>
  )
}

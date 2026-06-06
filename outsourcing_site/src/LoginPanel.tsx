import { useState, type ChangeEvent } from 'react'
import { TextInput, Button, Heading, Text } from '@primer/react'

export default function LoginPanel({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submitLogin() {
    setLoading(true)
    setError(null)
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const body = await res.json()
        setError(body.error || '로그인 실패')
      } else {
        const body = await res.json()
        localStorage.setItem('token', body.token)
        onLogin(body.token)
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
      <div style={{marginTop: 8}}>
        <label>이메일</label>
        <TextInput value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
      </div>
      <div style={{marginTop: 8}}>
        <label>비밀번호</label>
        <TextInput type="password" value={password} onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} />
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

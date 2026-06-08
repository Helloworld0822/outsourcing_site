import { useState, type ChangeEvent } from 'react'
import { TextInput, Button, Heading, Text, Select } from '@primer/react'
import { EyeIcon, EyeClosedIcon } from '@primer/octicons-react'
import { API_BASE } from './apiBase'
import { readJsonResponse, formatError } from './http'

type SessionUser = {
  id: string
  email: string
  name: string
  account_type: 'client' | 'freelancer'
}

export default function SignUpPanel({ onSignUp, onClose }: { onSignUp: (session: { token: string; user: SessionUser }) => void, onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<'client' | 'freelancer'>('client')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function validate() {
    if (!name.trim()) return '이름을 입력해주세요.'
    if (!email.includes('@')) return '유효한 이메일을 입력해주세요.'
    if (password.length < 6) return '비밀번호는 최소 6자 이상이어야 합니다.'
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
      const body = await readJsonResponse<{ error?: string; token?: string; user?: SessionUser }>(res)
      if (!res.ok) {
        setError(formatError(body?.error, '가입 실패'))
      } else {
        if (!body?.token || !body.user) {
          setError('가입 응답이 올바르지 않습니다.')
          return
        }
        localStorage.setItem('token', body.token)
        localStorage.setItem('user', JSON.stringify(body.user))
        onSignUp({ token: body.token, user: body.user })
        onClose()
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '서버와 통신 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
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

        {error && <Text color="danger.fg" style={{marginTop: 12}}>{error}</Text>}

        <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16}}>
          <Button variant="default" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submitSignUp} disabled={loading}>{loading ? '가입 중...' : '가입하기'}</Button>
        </div>
      </div>
    </div>
  )
}

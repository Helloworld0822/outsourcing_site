import { useState, type ChangeEvent } from 'react'
import { TextInput, Button, Heading, Text, Select, Label } from '@primer/react'

export default function SignUpPanel({ onSignUp, onClose }: { onSignUp: (token: string) => void, onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<'seller' | 'buyer'>('buyer')
  const [dob, setDob] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function validate() {
    if (!name.trim()) return '이름을 입력해주세요.'
    if (!username.trim()) return '아이디를 입력해주세요.'
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
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
      const res = await fetch(`${API_BASE}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, role, email, password, dob }),
      })
      if (!res.ok) {
        const body = await res.json()
        setError(body.error || '가입 실패')
      } else {
        const body = await res.json()
        localStorage.setItem('token', body.token)
        onSignUp(body.token)
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
          <div>
            <Label>이름</Label>
            <TextInput value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
          </div>
          <div>
            <Label>아이디</Label>
            <TextInput value={username} onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)} />
          </div>
          <div>
            <Label>회원 종류</Label>
            <Select onChange={(e: ChangeEvent<HTMLSelectElement>) => setRole(e.target.value === 'seller' ? 'seller' : 'buyer')} value={role}>
              <option value="buyer">구매자</option>
              <option value="seller">판매자</option>
            </Select>
          </div>
          <div>
            <Label>생년월일</Label>
            <TextInput type="date" value={dob} onChange={(e: ChangeEvent<HTMLInputElement>) => setDob(e.target.value)} />
          </div>

          <div style={{gridColumn: '1 / -1'}}>
            <Label>이메일</Label>
            <TextInput value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
          </div>

          <div>
            <Label>비밀번호</Label>
            <TextInput type="password" value={password} onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} />
          </div>
          <div>
            <Label>비밀번호 확인</Label>
            <TextInput type="password" value={confirm} onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)} />
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

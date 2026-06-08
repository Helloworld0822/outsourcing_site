import { useEffect, useState } from 'react'
import { Heading, Button } from '@primer/react'
import { API_BASE } from './apiBase'

type VerifyEmailProps = {
  token: string
  onVerified: () => void
}

export default function VerifyEmail({ token, onVerified }: VerifyEmailProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch(`${API_BASE}/api/verify-email/${token}`)
        const body = await res.json()
        if (res.ok) {
          setStatus('success')
          setMessage(body.message || '이메일 인증이 완료되었습니다.')
        } else {
          setStatus('error')
          setMessage(body.error || '인증에 실패했습니다.')
        }
      } catch {
        setStatus('error')
        setMessage('서버와 통신 중 오류가 발생했습니다.')
      }
    }
    verify()
  }, [token])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--overlay)',
      zIndex: 9999,
      padding: 16,
    }}>
      <div style={{
        background: 'var(--surface)',
        padding: 24,
        borderRadius: 16,
        width: 420,
        maxWidth: '100%',
        boxShadow: 'var(--shadow)',
        border: '1px solid var(--border)',
        textAlign: 'center',
      }}>
        {status === 'loading' && (
          <>
            <div style={{fontSize: 48, marginBottom: 16}}>⏳</div>
            <Heading as="h3">이메일 인증 중...</Heading>
            <p style={{marginTop: 12, color: 'var(--fg-muted)'}}>잠시만 기다려주세요.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{fontSize: 48, marginBottom: 16}}>✅</div>
            <Heading as="h3">인증 완료!</Heading>
            <p style={{marginTop: 12, color: 'var(--fg-muted)'}}>{message}</p>
            <div style={{marginTop: 20}}>
              <Button variant="primary" onClick={onVerified}>
                로그인하러 가기
              </Button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{fontSize: 48, marginBottom: 16}}>❌</div>
            <Heading as="h3">인증 실패</Heading>
            <p style={{marginTop: 12, color: '#cf222e'}}>{message}</p>
            <div style={{marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center'}}>
              <Button variant="primary" onClick={onVerified}>
                로그인 페이지로
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

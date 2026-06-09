import { useEffect, useState } from 'react'
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
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 420, textAlign: 'center' }}>
        <div className="card-body" style={{ padding: 32 }}>
          {status === 'loading' && (
            <>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--accent-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <svg width="24" height="24" viewBox="0 0 16 16" fill="var(--accent)"><path d="M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 8px 0' }}>이메일 인증 중...</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>잠시만 기다려주세요.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--success-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <svg width="24" height="24" viewBox="0 0 16 16" fill="var(--success)"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 8px 0' }}>인증 완료</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 24px 0' }}>{message}</p>
              <button className="btn btn-primary" onClick={onVerified}>
                로그인하러 가기
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--error-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <svg width="24" height="24" viewBox="0 0 16 16" fill="var(--error)"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 8px 0' }}>인증 실패</h3>
              <p style={{ color: 'var(--error)', fontSize: 14, margin: '0 0 24px 0' }}>{message}</p>
              <button className="btn btn-primary" onClick={onVerified}>
                로그인 페이지로
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

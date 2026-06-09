import { useState, type ChangeEvent } from 'react'
import { API_BASE } from './apiBase'
import { readJsonResponse, formatError } from './http'
import type { FreelancerService } from './FreelancerServiceForm'

export default function ServiceOrderDialog({
  service,
  token,
  onClose,
  onOrdered,
}: {
  service: FreelancerService
  token: string
  onClose: () => void
  onOrdered: () => void
}) {
  const [requirements, setRequirements] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!requirements.trim()) {
      setError('요구사항을 입력해주세요.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/freelancer/services/${service.id}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requirements }),
      })
      const body = await readJsonResponse<{ data: unknown } & { error?: unknown }>(res)
      if (!res.ok) {
        setError(formatError((body as { error?: unknown } | null)?.error, '주문 실패'))
      } else {
        onOrdered()
        onClose()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>서비스 주문</span>
          <button className="btn btn-ghost" onClick={onClose}>닫기</button>
        </div>

        <div className="card-body">
          <div style={{ marginBottom: 16, padding: 14, border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', background: 'var(--surface-alt)' }}>
            <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 4px 0' }}>{service.title}</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              {service.price} · {service.delivery_days}일 이내
            </p>
          </div>

          <div>
            <label className="form-label">요구사항 *</label>
            <textarea
              className="form-textarea"
              placeholder="원하는 작업 내용, 일정, 참고 자료 등을 자세히 적어주세요."
              value={requirements}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setRequirements(e.target.value)}
              rows={6}
            />
          </div>

          {error && (
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--error)' }}>{error}</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button className="btn btn-secondary" onClick={onClose}>취소</button>
            <button className="btn btn-primary" onClick={submit} disabled={loading}>
              {loading ? '주문 중...' : '주문하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

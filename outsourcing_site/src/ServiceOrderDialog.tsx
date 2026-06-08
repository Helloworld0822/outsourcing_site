import { useState, type ChangeEvent } from 'react'
import { Button, Heading, Text, Textarea } from '@primer/react'
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--overlay)',
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          padding: 20,
          borderRadius: 16,
          width: 520,
          maxWidth: '100%',
          boxShadow: 'var(--shadow)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Heading as="h3" style={{ margin: 0 }}>서비스 주문</Heading>
          <Button variant="invisible" onClick={onClose}>닫기</Button>
        </div>

        <div style={{ marginBottom: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
          <Text style={{ fontWeight: 'bold', display: 'block' }}>{service.title}</Text>
          <Text color="fg.muted" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
            {service.price} · {service.delivery_days}일 이내
          </Text>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label>요구사항 *</label>
          <Textarea
            placeholder="원하는 작업 내용, 일정, 참고 자료 등을 자세히 적어주세요."
            value={requirements}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setRequirements(e.target.value)}
            rows={6}
          />
        </div>

        {error && <Text color="danger.fg" style={{ display: 'block', marginTop: 10 }}>{error}</Text>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button variant="default" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit} disabled={loading}>
            {loading ? '주문 중...' : '주문하기'}
          </Button>
        </div>
      </div>
    </div>
  )
}

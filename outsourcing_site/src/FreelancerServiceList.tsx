import { useState, useEffect, type ChangeEvent } from 'react'
import { API_BASE } from './apiBase'
import { readJsonResponse, formatError, formatPrice } from './http'
import type { FreelancerService } from './FreelancerServiceForm'

const CATEGORY_LABELS: Record<string, string> = {
  development: '개발',
  design: '디자인',
  writing: '글쓰기/콘텐츠',
  marketing: '마케팅',
  translation: '번역',
  video: '영상/편집',
  other: '기타',
}

export default function FreelancerServiceList({
  token,
  refreshKey,
  onOrder,
}: {
  token: string | null
  refreshKey: number
  onOrder: (service: FreelancerService) => void
}) {
  const [services, setServices] = useState<FreelancerService[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (query.trim()) params.set('q', query.trim())
        if (category) params.set('category', category)
        const qs = params.toString() ? `?${params.toString()}` : ''
        const res = await fetch(`${API_BASE}/api/freelancer/services${qs}`)
        const body = await readJsonResponse<{ data: FreelancerService[] } & { error?: unknown }>(res)
        if (cancelled) return
        if (!res.ok) {
          setError(formatError((body as { error?: unknown } | null)?.error, '서비스 목록 조회 실패'))
        } else {
          setServices(body?.data ?? [])
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '네트워크 오류')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [query, category, refreshKey])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <h2 className="section-title" style={{ margin: 0 }}>프리랜서 서비스</h2>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm-.82 4.74a6 6 0 1 1 1.06-1.06l3.04 3.04a.75.75 0 1 1-1.06 1.06l-3.04-3.04Z"/></svg>
          <input
            className="form-input"
            style={{ paddingLeft: 32 }}
            placeholder="서비스 검색..."
            value={query}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {['전체', ...Object.entries(CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }))].map((item) => {
          const value = item === '전체' ? null : (item as { value: string; label: string }).value
          const label = item === '전체' ? '전체' : (item as { value: string; label: string }).label
          const active = (value === null && category === null) || value === category
          return (
            <button
              key={label}
              onClick={() => setCategory(value)}
              className={`chip ${active ? 'chip-accent' : ''}`}
              style={{ cursor: 'pointer' }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {error && (
        <p style={{ marginBottom: 12, fontSize: 13, color: 'var(--error)' }}>{error}</p>
      )}
      {loading && (
        <p style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>불러오는 중...</p>
      )}

      {!loading && services.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>등록된 서비스가 없습니다.</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {services.map((s) => (
          <div key={s.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            {s.thumbnail_url ? (
              <img
                src={s.thumbnail_url}
                alt={s.title}
                style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: 160,
                  borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                  background: 'var(--surface-alt)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                }}
              >
                {CATEGORY_LABELS[s.category] ?? s.category}
              </div>
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 20px 20px' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px 0', lineHeight: 1.4 }}>{s.title}</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                by {s.freelancer?.name ?? '프리랜서'}
              </span>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10, flex: 1, margin: '0 0 10px 0' }}>
                {s.description.length > 100 ? `${s.description.slice(0, 100)}...` : s.description}
              </p>

              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                {s.skills.slice(0, 4).map((sk) => (
                  <span key={sk} className="chip">{sk}</span>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 16, display: 'block', color: 'var(--text)' }}>{formatPrice(s.price)}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block' }}>{s.delivery_days}일 이내</span>
                </div>
                {token ? (
                  <button className="btn btn-primary" onClick={() => onOrder(s)}>
                    주문
                  </button>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>로그인 필요</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

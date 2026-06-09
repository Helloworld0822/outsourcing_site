import { useState, useEffect, type ChangeEvent } from 'react'
import { Button, Heading, Text, TextInput } from '@primer/react'
import { HeartIcon, SearchIcon } from '@primer/octicons-react'
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <Heading as="h2" style={{ margin: 0 }}>프리랜서 서비스</Heading>
        <div style={{ flex: 1, maxWidth: 360 }}>
          <TextInput
            leadingVisual={SearchIcon}
            placeholder="서비스 검색..."
            value={query}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            block
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {['전체', ...Object.entries(CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }))].map((item) => {
          const value = item === '전체' ? null : (item as { value: string; label: string }).value
          const label = item === '전체' ? '전체' : (item as { value: string; label: string }).label
          const active = (value === null && category === null) || value === category
          return (
            <button
              key={label}
              onClick={() => setCategory(value)}
              style={{
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: active ? 'var(--accent)' : 'var(--surface)',
                color: active ? 'white' : 'inherit',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {error && <Text color="danger.fg" style={{ display: 'block', marginBottom: 12 }}>{error}</Text>}
      {loading && <Text color="fg.muted" style={{ display: 'block', marginBottom: 12 }}>불러오는 중...</Text>}

      {!loading && services.length === 0 && (
        <Text color="fg.muted" style={{ display: 'block' }}>등록된 서비스가 없습니다.</Text>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {services.map((s) => (
          <div
            key={s.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 14,
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {s.thumbnail_url ? (
              <img
                src={s.thumbnail_url}
                alt={s.title}
                style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 6, marginBottom: 10 }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: 140,
                  borderRadius: 6,
                  background: 'var(--code-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 12,
                  marginBottom: 10,
                }}
              >
                {CATEGORY_LABELS[s.category] ?? s.category}
              </div>
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Heading as="h4" style={{ fontSize: 15, margin: 0, marginBottom: 4 }}>{s.title}</Heading>
              <Text color="fg.muted" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                by {s.freelancer?.name ?? '프리랜서'}
              </Text>
              <Text style={{ fontSize: 13, display: 'block', marginBottom: 8, flex: 1, lineHeight: 1.45 }}>
                {s.description.length > 100 ? `${s.description.slice(0, 100)}...` : s.description}
              </Text>

              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {s.skills.slice(0, 4).map((sk) => (
                  <span key={sk} style={{
                    fontSize: 11,
                    border: '1px solid var(--border)',
                    borderRadius: 999,
                    padding: '1px 7px',
                  }}>{sk}</span>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                <div>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, display: 'block' }}>{formatPrice(s.price)}</Text>
                  <Text color="fg.muted" style={{ fontSize: 11, display: 'block' }}>{s.delivery_days}일 이내</Text>
                </div>
                {token ? (
                  <Button variant="primary" size="small" onClick={() => onOrder(s)} leadingVisual={HeartIcon}>
                    주문
                  </Button>
                ) : (
                  <Text color="fg.muted" style={{ fontSize: 11 }}>로그인 필요</Text>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

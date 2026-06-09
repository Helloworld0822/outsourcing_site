import { useState, type ChangeEvent } from 'react'
import { API_BASE } from './apiBase'
import { readJsonResponse, formatError } from './http'

export type FreelancerService = {
  id: string
  freelancer_id: string
  title: string
  description: string
  category: string
  skills: string[]
  price: string
  delivery_days: number
  thumbnail_url: string | null
  is_active: boolean
  inserted_at: string | null
  freelancer?: { id: string; name: string; email: string }
}

const CATEGORIES = [
  { value: 'development', label: '개발' },
  { value: 'design', label: '디자인' },
  { value: 'writing', label: '글쓰기/콘텐츠' },
  { value: 'marketing', label: '마케팅' },
  { value: 'translation', label: '번역' },
  { value: 'video', label: '영상/편집' },
  { value: 'other', label: '기타' },
]

function splitSkills(value: string) {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function FreelancerServiceForm({
  token,
  onCreated,
}: {
  token: string
  onCreated: (service: FreelancerService) => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('development')
  const [skills, setSkills] = useState('')
  const [price, setPrice] = useState('')
  const [deliveryDays, setDeliveryDays] = useState(7)
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function reset() {
    setTitle('')
    setDescription('')
    setCategory('development')
    setSkills('')
    setPrice('')
    setDeliveryDays(7)
    setThumbnailUrl('')
    setError(null)
  }

  async function submit() {
    if (!title.trim() || !description.trim() || !price.trim()) {
      setError('제목, 설명, 가격은 필수입니다.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/freelancer/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          category,
          skills: splitSkills(skills),
          price,
          delivery_days: deliveryDays,
          thumbnail_url: thumbnailUrl || null,
        }),
      })
      const body = await readJsonResponse<{ data: FreelancerService } & { error?: unknown }>(res)
      if (!res.ok) {
        setError(formatError((body as { error?: unknown } | null)?.error, '서비스 등록 실패'))
      } else if (body?.data) {
        onCreated(body.data)
        reset()
        setOpen(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 1 1 0 1.5H8.5v4.25a.75.75 0 1 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"/></svg>
        새 서비스 등록
      </button>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>새 서비스 등록</span>
        <button className="btn btn-ghost" onClick={() => { reset(); setOpen(false) }}>
          닫기
        </button>
      </div>

      <div className="card-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16 }}>
          <div>
            <label className="form-label">서비스 제목 *</label>
            <input
              className="form-input"
              placeholder="예) React로 반응형 웹앱 개발"
              value={title}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">카테고리 *</label>
            <select
              className="form-input"
              value={category}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label className="form-label">상세 설명 *</label>
          <textarea
            className="form-textarea"
            placeholder="어떤 서비스를 제공하는지, 작업 범위, 포함 사항 등을 자세히 적어주세요."
            value={description}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            rows={5}
          />
        </div>

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
          <div>
            <label className="form-label">기술 스택 (쉼표 구분)</label>
            <input
              className="form-input"
              placeholder="React, TypeScript, Next.js"
              value={skills}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSkills(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">가격 *</label>
            <input
              className="form-input"
              placeholder="500,000원"
              value={price}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">작업일 (일)</label>
            <input
              className="form-input"
              type="number"
              min={1}
              value={String(deliveryDays)}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDeliveryDays(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label className="form-label">썸네일 URL (선택)</label>
          <input
            className="form-input"
            placeholder="https://..."
            value={thumbnailUrl}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setThumbnailUrl(e.target.value)}
          />
        </div>

        {error && (
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--error)' }}>{error}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={() => { reset(); setOpen(false) }}>
            취소
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? '등록 중...' : '등록하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

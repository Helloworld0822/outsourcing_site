import { useState, type ChangeEvent } from 'react'
import { TextInput, Textarea, Button, Heading, Text, Select } from '@primer/react'
import { PlusIcon } from '@primer/octicons-react'
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
      <Button variant="primary" onClick={() => setOpen(true)} leadingVisual={PlusIcon}>
        새 서비스 등록
      </Button>
    )
  }

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 20,
        background: 'var(--surface)',
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Heading as="h3" style={{ fontSize: 18, margin: 0 }}>새 서비스 등록</Heading>
        <Button variant="invisible" onClick={() => { reset(); setOpen(false) }}>닫기</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label>서비스 제목 *</label>
          <TextInput
            placeholder="예) React로 반응형 웹앱 개발"
            value={title}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label>카테고리 *</label>
          <Select value={category} onChange={(e: ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label>상세 설명 *</label>
        <Textarea
          placeholder="어떤 서비스를 제공하는지, 작업 범위, 포함 사항 등을 자세히 적어주세요."
          value={description}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
          rows={5}
        />
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label>기술 스택 (쉼표 구분)</label>
          <TextInput
            placeholder="React, TypeScript, Next.js"
            value={skills}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSkills(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label>가격 *</label>
          <TextInput
            placeholder="₩500,000"
            value={price}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label>작업일 (일)</label>
          <TextInput
            type="number"
            min={1}
            value={String(deliveryDays)}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDeliveryDays(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label>썸네일 URL (선택)</label>
        <TextInput
          placeholder="https://..."
          value={thumbnailUrl}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setThumbnailUrl(e.target.value)}
        />
      </div>

      {error && <Text color="danger.fg" style={{ display: 'block', marginTop: 10 }}>{error}</Text>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button variant="default" onClick={() => { reset(); setOpen(false) }}>취소</Button>
        <Button variant="primary" onClick={submit} disabled={loading}>
          {loading ? '등록 중...' : '등록하기'}
        </Button>
      </div>
    </div>
  )
}

import { useState, useEffect, type ChangeEvent } from 'react'
import type { UserProfile, ProfileUpdatePayload, PortfolioItem } from './types'
import { API_BASE } from '../api/apiBase'
import { readJsonResponse } from '../api/http'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function initials(name?: string | null) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function generateId() {
  return Math.random().toString(36).slice(2)
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────────────────────

function ProfileAvatar({
  url,
  name,
  size = 96,
  editable,
  onUrlChange,
}: {
  url?: string | null
  name?: string | null
  size?: number
  editable?: boolean
  onUrlChange?: (url: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(url ?? '')

  function submit() {
    onUrlChange?.(draft)
    setEditing(false)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: url
            ? 'transparent'
            : 'linear-gradient(135deg, var(--accent), #7c3aed)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.32,
          fontWeight: 700,
          color: 'white',
          border: '3px solid var(--surface)',
          boxShadow: 'var(--shadow-md)',
          flexShrink: 0,
        }}
      >
        {url ? (
          <img
            src={url}
            alt={name ?? 'avatar'}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          initials(name)
        )}
      </div>
      {editable && (
        <button
          onClick={() => setEditing((v) => !v)}
          style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'var(--accent)',
            border: '2px solid var(--surface)',
            color: 'white',
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="아바타 URL 변경"
        >
          ✏️
        </button>
      )}
      {editing && (
        <div
          style={{
            position: 'absolute',
            top: size + 8,
            left: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            padding: 12,
            zIndex: 100,
            width: 280,
          }}
        >
          <label className="form-label">아바타 이미지 URL</label>
          <input
            className="form-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://..."
            style={{ marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={submit} style={{ flex: 1, fontSize: 12 }}>
              저장
            </button>
            <button className="btn btn-secondary" onClick={() => setEditing(false)} style={{ fontSize: 12 }}>
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill Tag
// ─────────────────────────────────────────────────────────────────────────────

function SkillTag({ skill, onRemove }: { skill: string; onRemove?: () => void }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        background: 'var(--accent-light)',
        color: 'var(--accent)',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        border: '1px solid rgba(37,99,235,0.15)',
      }}
    >
      {skill}
      {onRemove && (
        <button
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 2px',
            lineHeight: 1,
            color: 'var(--accent)',
            fontSize: 11,
          }}
        >
          ×
        </button>
      )}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio Card (view)
// ─────────────────────────────────────────────────────────────────────────────

function PortfolioCard({ item }: { item: PortfolioItem }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s',
      }}
      className="card"
    >
      {item.image_url && (
        <img
          src={item.image_url}
          alt={item.title}
          style={{ width: '100%', height: 140, objectFit: 'cover' }}
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      )}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{item.title}</div>
        {item.description && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {item.description}
          </div>
        )}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: 'var(--accent)', marginTop: 8, display: 'inline-block' }}
          >
            🔗 링크 보기
          </a>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio Editor
// ─────────────────────────────────────────────────────────────────────────────

function PortfolioEditor({
  items,
  onChange,
}: {
  items: PortfolioItem[]
  onChange: (items: PortfolioItem[]) => void
}) {
  const [draft, setDraft] = useState<Partial<PortfolioItem>>({})
  const [adding, setAdding] = useState(false)

  function addItem() {
    if (!draft.title?.trim()) return
    onChange([...items, { id: generateId(), title: draft.title, description: draft.description ?? '', url: draft.url, image_url: draft.image_url }])
    setDraft({})
    setAdding(false)
  }

  function removeItem(id: string) {
    onChange(items.filter((i) => i.id !== id))
  }

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 12,
        }}
      >
        {items.map((item) => (
          <div key={item.id} style={{ position: 'relative' }}>
            <PortfolioCard item={item} />
            <button
              onClick={() => removeItem(item.id)}
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                background: 'var(--error)',
                border: 'none',
                borderRadius: '50%',
                width: 22,
                height: 22,
                color: 'white',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {adding ? (
        <div
          style={{
            background: 'var(--surface-alt)',
            borderRadius: 'var(--radius)',
            padding: 16,
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <label className="form-label">제목 *</label>
              <input
                className="form-input"
                value={draft.title ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="프로젝트 이름"
              />
            </div>
            <div>
              <label className="form-label">설명</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={draft.description ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="간단한 프로젝트 설명"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="form-label">URL</label>
                <input
                  className="form-input"
                  value={draft.url ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="form-label">이미지 URL</label>
                <input
                  className="form-input"
                  value={draft.image_url ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, image_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={addItem} style={{ fontSize: 12 }}>
                추가
              </button>
              <button className="btn btn-secondary" onClick={() => { setAdding(false); setDraft({}) }} style={{ fontSize: 12 }}>
                취소
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-secondary"
          onClick={() => setAdding(true)}
          style={{ fontSize: 12, width: '100%', border: '2px dashed var(--border)' }}
        >
          + 포트폴리오 추가
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Badge
// ─────────────────────────────────────────────────────────────────────────────

function StatBadge({ icon, label, value }: { icon: string; label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: 'var(--surface-alt)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 13,
        border: '1px solid var(--border-light)',
      }}
    >
      <span>{icon}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{label}:</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ProfilePage component
// ─────────────────────────────────────────────────────────────────────────────

interface ProfilePageProps {
  token: string
  onClose?: () => void
}

export default function ProfilePage({ token, onClose }: ProfilePageProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Edit form state
  const [form, setForm] = useState<ProfileUpdatePayload>({})
  const [skillInput, setSkillInput] = useState('')

  useEffect(() => {
    fetchProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!statusMsg) return
    const t = setTimeout(() => setStatusMsg(null), 3500)
    return () => clearTimeout(t)
  }, [statusMsg])

  async function fetchProfile() {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await readJsonResponse<{ data?: UserProfile; error?: string }>(res)
      if (!res.ok) throw new Error(body?.error ?? '프로필을 불러오지 못했습니다.')
      setProfile(body?.data ?? null)
    } catch (e) {
      setStatusMsg({ type: 'error', text: e instanceof Error ? e.message : '오류가 발생했습니다.' })
    } finally {
      setLoading(false)
    }
  }

  function startEdit() {
    if (!profile) return
    setForm({
      bio: profile.bio ?? '',
      avatar_url: profile.avatar_url ?? '',
      location: profile.location ?? '',
      website_url: profile.website_url ?? '',
      github_url: profile.github_url ?? '',
      skills: [...(profile.skills ?? [])],
      hourly_rate: profile.hourly_rate ?? '',
      experience_years: profile.experience_years ?? undefined,
      portfolio_items: (profile.portfolio_items ?? []).map((p) => ({ ...p })),
      is_public: profile.is_public ?? true,
    })
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setForm({})
    setSkillInput('')
  }

  async function saveProfile() {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { ...form }
      // Clean empty strings
      if (payload.avatar_url === '') payload.avatar_url = null
      if (payload.hourly_rate === '') payload.hourly_rate = null
      if (payload.location === '') payload.location = null
      if (payload.website_url === '') payload.website_url = null
      if (payload.github_url === '') payload.github_url = null
      if (payload.bio === '') payload.bio = null

      const res = await fetch(`${API_BASE}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      const body = await readJsonResponse<{ data?: UserProfile; error?: string }>(res)
      if (!res.ok) throw new Error(body?.error ?? '저장에 실패했습니다.')
      setProfile(body?.data ?? null)
      setEditing(false)
      setForm({})
      setStatusMsg({ type: 'success', text: '프로필이 저장되었습니다.' })
    } catch (e) {
      setStatusMsg({ type: 'error', text: e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.' })
    } finally {
      setSaving(false)
    }
  }

  function addSkill() {
    const s = skillInput.trim()
    if (!s) return
    const current = form.skills ?? []
    if (!current.includes(s)) {
      setForm((f) => ({ ...f, skills: [...(f.skills ?? []), s] }))
    }
    setSkillInput('')
  }

  function removeSkill(skill: string) {
    setForm((f) => ({ ...f, skills: (f.skills ?? []).filter((s) => s !== skill) }))
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const displayProfile = profile
  const accountType = displayProfile?.user?.account_type
  const isFreelancer = accountType === 'freelancer'

  return (
    <div style={{ animation: 'fadeIn 0.25s ease' }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onClose && (
            <button className="btn btn-ghost" onClick={onClose} style={{ padding: '6px 10px' }}>
              ← 뒤로
            </button>
          )}
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>내 프로필</h2>
        </div>

        {!editing ? (
          <button className="btn btn-primary" onClick={startEdit} disabled={loading}>
            ✏️ 프로필 수정
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={cancelEdit}>
              취소
            </button>
            <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
              {saving ? '저장 중...' : '💾 저장'}
            </button>
          </div>
        )}
      </div>

      {/* Status toast */}
      {statusMsg && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius)',
            background: statusMsg.type === 'success' ? 'var(--success-light)' : 'var(--error-light)',
            color: statusMsg.type === 'success' ? 'var(--success)' : 'var(--error)',
            border: `1px solid ${statusMsg.type === 'success' ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`,
            marginBottom: 20,
            fontSize: 13,
            fontWeight: 500,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {statusMsg.type === 'success' ? '✅ ' : '❌ '}{statusMsg.text}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div>프로필을 불러오는 중...</div>
        </div>
      ) : editing ? (
        /* ─── EDIT MODE ─────────────────────────────────────────── */
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Basic info */}
          <div className="card">
            <div className="card-header">
              <div className="section-title" style={{ margin: 0 }}>기본 정보</div>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <ProfileAvatar
                  url={form.avatar_url}
                  name={displayProfile?.user?.name}
                  size={88}
                  editable
                  onUrlChange={(url) => setForm((f) => ({ ...f, avatar_url: url }))}
                />
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label className="form-label">자기소개</label>
                      <textarea
                        className="form-textarea"
                        rows={4}
                        value={form.bio ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                        placeholder="자신을 간략하게 소개해주세요..."
                        maxLength={1000}
                      />
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>
                        {(form.bio ?? '').length}/1000
                      </div>
                    </div>
                    <div>
                      <label className="form-label">📍 위치</label>
                      <input
                        className="form-input"
                        value={form.location ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                        placeholder="서울, 대한민국"
                      />
                    </div>
                    <div>
                      <label className="form-label">🌐 웹사이트</label>
                      <input
                        className="form-input"
                        value={form.website_url ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
                        placeholder="https://yoursite.com"
                      />
                    </div>
                    <div>
                      <label className="form-label">🐙 GitHub</label>
                      <input
                        className="form-input"
                        value={form.github_url ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, github_url: e.target.value }))}
                        placeholder="https://github.com/username"
                      />
                    </div>
                    <div>
                      <label className="form-label">🔒 공개 여부</label>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer',
                          padding: '8px 12px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={form.is_public ?? true}
                          onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))}
                          style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                        />
                        <span style={{ fontSize: 13 }}>{form.is_public ? '공개' : '비공개'}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Freelancer-specific */}
          {isFreelancer && (
            <div className="card">
              <div className="card-header">
                <div className="section-title" style={{ margin: 0 }}>프리랜서 정보</div>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <div>
                    <label className="form-label">💰 시간당 요율</label>
                    <input
                      className="form-input"
                      value={form.hourly_rate ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, hourly_rate: e.target.value }))}
                      placeholder="50,000원/시간"
                    />
                  </div>
                  <div>
                    <label className="form-label">📅 경력 (년)</label>
                    <input
                      type="number"
                      className="form-input"
                      min={0}
                      max={50}
                      value={form.experience_years ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setForm((f) => ({ ...f, experience_years: v === '' ? undefined : parseInt(v) }))
                      }}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <label className="form-label">🛠️ 기술 스택</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {(form.skills ?? []).map((s) => (
                      <SkillTag key={s} skill={s} onRemove={() => removeSkill(s)} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="form-input"
                      value={skillInput}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); addSkill() }
                      }}
                      placeholder="기술 입력 후 Enter 또는 추가 클릭"
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-secondary" onClick={addSkill} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      + 추가
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Portfolio */}
          {isFreelancer && (
            <div className="card">
              <div className="card-header">
                <div className="section-title" style={{ margin: 0 }}>🗂️ 포트폴리오</div>
              </div>
              <div className="card-body">
                <PortfolioEditor
                  items={form.portfolio_items ?? []}
                  onChange={(items) => setForm((f) => ({ ...f, portfolio_items: items }))}
                />
              </div>
            </div>
          )}
        </div>
      ) : displayProfile ? (
        /* ─── VIEW MODE ─────────────────────────────────────────── */
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Hero card */}
          <div
            className="card"
            style={{
              background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-alt) 100%)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Decorative gradient blob */}
            <div
              style={{
                position: 'absolute',
                top: -40,
                right: -40,
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />
            <div className="card-body">
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <ProfileAvatar
                  url={displayProfile.avatar_url}
                  name={displayProfile.user?.name}
                  size={96}
                />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                      {displayProfile.user?.name ?? '이름 없음'}
                    </h3>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: isFreelancer ? 'var(--accent-light)' : 'var(--success-light)',
                        color: isFreelancer ? 'var(--accent)' : 'var(--success)',
                      }}
                    >
                      {isFreelancer ? '프리랜서' : '클라이언트'}
                    </span>
                    {!displayProfile.is_public && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🔒 비공개</span>
                    )}
                  </div>

                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
                    {displayProfile.user?.email}
                  </div>

                  {displayProfile.bio && (
                    <p
                      style={{
                        margin: '0 0 14px',
                        color: 'var(--text-secondary)',
                        fontSize: 14,
                        lineHeight: 1.6,
                        maxWidth: 520,
                      }}
                    >
                      {displayProfile.bio}
                    </p>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <StatBadge icon="📍" label="위치" value={displayProfile.location} />
                    <StatBadge icon="💰" label="요율" value={displayProfile.hourly_rate} />
                    <StatBadge icon="📅" label="경력" value={displayProfile.experience_years != null ? `${displayProfile.experience_years}년` : null} />
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    {displayProfile.website_url && (
                      <a href={displayProfile.website_url} target="_blank" rel="noopener noreferrer">
                        <button className="btn btn-secondary" style={{ fontSize: 12 }}>
                          🌐 웹사이트
                        </button>
                      </a>
                    )}
                    {displayProfile.github_url && (
                      <a href={displayProfile.github_url} target="_blank" rel="noopener noreferrer">
                        <button className="btn btn-secondary" style={{ fontSize: 12 }}>
                          🐙 GitHub
                        </button>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Skills */}
          {isFreelancer && (displayProfile.skills?.length ?? 0) > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="section-title" style={{ margin: 0 }}>🛠️ 기술 스택</div>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {displayProfile.skills.map((s) => (
                    <SkillTag key={s} skill={s} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Portfolio */}
          {isFreelancer && (displayProfile.portfolio_items?.length ?? 0) > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="section-title" style={{ margin: 0 }}>🗂️ 포트폴리오</div>
              </div>
              <div className="card-body">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 14,
                  }}
                >
                  {displayProfile.portfolio_items.map((item) => (
                    <PortfolioCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Empty state hint */}
          {!displayProfile.bio && (displayProfile.skills?.length ?? 0) === 0 && !displayProfile.location && (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: 'var(--surface)',
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--text-muted)',
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 10 }}>👤</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>프로필이 비어있습니다</div>
              <div style={{ fontSize: 13 }}>
                프로필 수정 버튼을 클릭해 자기소개, 기술 스택, 포트폴리오를 추가해보세요.
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          프로필을 불러올 수 없습니다.
        </div>
      )}
    </div>
  )
}

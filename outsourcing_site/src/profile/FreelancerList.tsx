import { useState, useEffect } from 'react'
import type { UserProfile } from './types'
import { API_BASE } from '../api/apiBase'
import { readJsonResponse } from '../api/http'

function initials(name?: string | null) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

function SkillTag({ skill }: { skill: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
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
    </span>
  )
}

interface FreelancerListProps {
  token?: string | null
  onSelectFreelancer?: (userId: string) => void
}

export default function FreelancerList({ token, onSelectFreelancer }: FreelancerListProps) {
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [skillFilter, setSkillFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProfiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, skillFilter])

  async function fetchProfiles() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (skillFilter.trim()) params.set('skill', skillFilter.trim())

      const res = await fetch(`${API_BASE}/api/freelancers?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const body = await readJsonResponse<{ data?: any[]; error?: string }>(res)
      if (!res.ok) throw new Error(body?.error ?? '불러오기 실패')
      setProfiles(body?.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // Collect all unique skills
  const allSkills = Array.from(new Set(profiles.flatMap((p) => p.skills ?? [])))

  return (
    <div>
      {/* Filter bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <input
          className="form-input"
          placeholder="🔍 프리랜서 이름, 소개 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="form-input"
          value={skillFilter}
          onChange={(e) => setSkillFilter(e.target.value)}
          style={{ width: 180 }}
        >
          <option value="">모든 기술</option>
          {allSkills.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius)',
            background: 'var(--error-light)',
            color: 'var(--error)',
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          ❌ {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div>프리랜서 목록을 불러오는 중...</div>
        </div>
      ) : profiles.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '50px 20px',
            background: 'var(--surface)',
            border: '2px dashed var(--border)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>프리랜서를 찾을 수 없습니다</div>
          <div style={{ fontSize: 13 }}>다른 검색어나 필터를 시도해보세요.</div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {profiles.map((p) => (
            <FreelancerCard key={p.user_id} profile={p} onSelect={onSelectFreelancer} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function FreelancerCard({
  profile,
  onSelect,
}: {
  profile: UserProfile
  onSelect?: (userId: string) => void
}) {
  const name = profile.user?.name
  const skills = profile.skills ?? []

  return (
    <div
      className="card"
      style={{
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s, transform 0.15s',
      }}
      onClick={() => onSelect?.(profile.user_id)}
      onMouseEnter={(e) => {
        if (onSelect) {
          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'
        }
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.transform = ''
        ;(e.currentTarget as HTMLElement).style.boxShadow = ''
      }}
    >
      <div className="card-body">
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 }}>
          {/* Avatar */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: profile.avatar_url
                ? 'transparent'
                : 'linear-gradient(135deg, var(--accent), #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
              color: 'white',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={name ?? ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              initials(name)
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{name ?? '이름 없음'}</div>
            {profile.location && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📍 {profile.location}</div>
            )}
            {profile.experience_years != null && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                📅 경력 {profile.experience_years}년
              </div>
            )}
          </div>

          {profile.hourly_rate && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--accent)',
                background: 'var(--accent-light)',
                padding: '3px 8px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {profile.hourly_rate}
            </div>
          )}
        </div>

        {profile.bio && (
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              marginBottom: 12,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {profile.bio}
          </p>
        )}

        {skills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {skills.slice(0, 5).map((s) => (
              <SkillTag key={s} skill={s} />
            ))}
            {skills.length > 5 && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
                +{skills.length - 5}
              </span>
            )}
          </div>
        )}

        {onSelect && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%', fontSize: 13 }}
              onClick={(e) => { e.stopPropagation(); onSelect(profile.user_id) }}
            >
              프로필 보기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

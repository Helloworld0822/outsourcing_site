import { useState, useEffect } from 'react'
import type { UserProfile, PortfolioItem } from './types'
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

function PortfolioCard({ item }: { item: PortfolioItem }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {item.image_url && (
        <img
          src={item.image_url}
          alt={item.title}
          style={{ width: '100%', height: 140, objectFit: 'cover' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
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

interface PublicProfileViewProps {
  userId: string
  token?: string | null
  onBack?: () => void
  onContactFreelancer?: (freelancerId: string) => void
}

export default function PublicProfileView({ userId, token, onBack, onContactFreelancer }: PublicProfileViewProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/profiles/${userId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        const body = await readJsonResponse<{ data?: UserProfile; error?: string }>(res)
        if (!res.ok) throw new Error(body?.error ?? '불러오기 실패')
        setProfile(body?.data ?? null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [userId, token])

  const isFreelancer = profile?.user?.account_type === 'freelancer'

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div>프로필을 불러오는 중...</div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        {onBack && (
          <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 16 }}>
            ← 목록으로
          </button>
        )}
        <div style={{ fontSize: 32, marginBottom: 12 }}>😕</div>
        <div style={{ color: 'var(--text-muted)' }}>{error ?? '프로필을 찾을 수 없습니다.'}</div>
      </div>
    )
  }

  return (
    <div style={{ animation: 'fadeIn 0.25s ease' }}>
      {/* Back button */}
      {onBack && (
        <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 20 }}>
          ← 목록으로
        </button>
      )}

      {/* Hero */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-alt) 100%)',
          overflow: 'hidden',
          position: 'relative',
          marginBottom: 20,
        }}
      >
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
            {/* Avatar */}
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                background: profile.avatar_url
                  ? 'transparent'
                  : 'linear-gradient(135deg, var(--accent), #7c3aed)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
                fontWeight: 700,
                color: 'white',
                flexShrink: 0,
                overflow: 'hidden',
                border: '3px solid var(--surface)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.user?.name ?? ''}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                initials(profile.user?.name)
              )}
            </div>

            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                  {profile.user?.name ?? '이름 없음'}
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
              </div>

              {profile.bio && (
                <p style={{ margin: '0 0 14px', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, maxWidth: 520 }}>
                  {profile.bio}
                </p>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {profile.location && (
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>📍 {profile.location}</span>
                )}
                {profile.hourly_rate && (
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--accent)',
                      background: 'var(--accent-light)',
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}
                  >
                    💰 {profile.hourly_rate}
                  </span>
                )}
                {profile.experience_years != null && (
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    📅 경력 {profile.experience_years}년
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {profile.website_url && (
                  <a href={profile.website_url} target="_blank" rel="noopener noreferrer">
                    <button className="btn btn-secondary" style={{ fontSize: 12 }}>🌐 웹사이트</button>
                  </a>
                )}
                {profile.github_url && (
                  <a href={profile.github_url} target="_blank" rel="noopener noreferrer">
                    <button className="btn btn-secondary" style={{ fontSize: 12 }}>🐙 GitHub</button>
                  </a>
                )}
                {isFreelancer && onContactFreelancer && (
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 12 }}
                    onClick={() => onContactFreelancer(userId)}
                  >
                    💬 채팅하기
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Skills */}
      {isFreelancer && (profile.skills?.length ?? 0) > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="section-title" style={{ margin: 0 }}>🛠️ 기술 스택</div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {profile.skills.map((s) => (
                <SkillTag key={s} skill={s} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Portfolio */}
      {isFreelancer && (profile.portfolio_items?.length ?? 0) > 0 && (
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
              {profile.portfolio_items.map((item) => (
                <PortfolioCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

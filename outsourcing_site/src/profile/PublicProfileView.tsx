import { useState, useEffect } from 'react'
import { MapPin, Calendar, DollarSign, Globe, CodeXml, MessageCircle, Wrench, FolderOpen, Link, Loader2 } from 'lucide-react'
import type { UserProfile, PortfolioItem } from './types'
import { API_BASE } from '../api/apiBase'
import { readJsonResponse } from '../api/http'

function initials(name?: string | null) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

const DUMMY_PROFILES: Record<string, UserProfile> = {
  'u-1': {
    id: 'prof-1', user_id: 'u-1', bio: '5년차 프론트엔드 개발자입니다. React, Vue 기반 웹 앱 개발 전문. 사용자 경험을 최우선으로 생각하며, 접근성과 성능 최적화에 관심이 많습니다.', avatar_url: null, location: '서울', website_url: 'https://taehyun.dev', github_url: 'https://github.com/taehyun',
    skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Figma'], hourly_rate: '50,000원/h', experience_years: 5,
    portfolio_items: [
      { id: 'p1', title: '이커머스 플랫폼 리뉴얼', description: 'React + Next.js 기반 쇼핑몰 전면 리뉴얼. 페이지 로딩 속도 60% 개선.', url: 'https://example.com' },
      { id: 'p2', title: '사내 대시보드', description: 'Vue.js + D3.js 기반 실시간 모니터링 대시보드.' },
    ],
    is_public: true, inserted_at: '2026-01-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z',
    user: { id: 'u-1', name: '김태현', email: 'taehyun@example.com', account_type: 'freelancer' },
  },
  'u-2': {
    id: 'prof-2', user_id: 'u-2', bio: '백엔드/인프라 엔지니어. 대규모 트래픽 처리에 특화된 시스템 설계 경험이 있습니다. Java, Spring Boot 기반 마이크로서비스 아키텍처 전문.', avatar_url: null, location: '서울', website_url: null, github_url: 'https://github.com/sujin',
    skills: ['Java', 'Spring Boot', 'AWS', 'Docker', 'Kubernetes', 'PostgreSQL'], hourly_rate: '60,000원/h', experience_years: 7,
    portfolio_items: [
      { id: 'p3', title: '실시간 주문 처리 시스템', description: '분당 10,000건 이상 처리 가능한 이벤트 기반 아키텍처.' },
    ],
    is_public: true, inserted_at: '2026-01-02T00:00:00Z', updated_at: '2026-06-02T00:00:00Z',
    user: { id: 'u-2', name: '이수진', email: 'sujin@example.com', account_type: 'freelancer' },
  },
  'u-3': {
    id: 'prof-3', user_id: 'u-3', bio: 'UI/UX 디자이너. 모바일/웹 서비스 디자인 경력 4년. 사용자 리서치부터 프로토타입까지 풀스택 디자인 프로세스를 담당합니다.', avatar_url: null, location: '부산', website_url: null, github_url: null,
    skills: ['Figma', 'Adobe XD', 'Sketch', 'Photoshop', 'Illustrator'], hourly_rate: '40,000원/h', experience_years: 4,
    portfolio_items: [], is_public: true, inserted_at: '2026-01-03T00:00:00Z', updated_at: '2026-06-03T00:00:00Z',
    user: { id: 'u-3', name: '박지은', email: 'jieun@example.com', account_type: 'freelancer' },
  },
  'u-4': {
    id: 'prof-4', user_id: 'u-4', bio: '모바일 크로스플랫폼 개발자. Flutter와 React Native 모두 가능. 네이티브 성능을 유지하면서 크로스플랫폼 개발.', avatar_url: null, location: '대구', website_url: null, github_url: null,
    skills: ['Flutter', 'Dart', 'React Native', 'Firebase', 'Swift'], hourly_rate: '55,000원/h', experience_years: 3,
    portfolio_items: [], is_public: true, inserted_at: '2026-01-04T00:00:00Z', updated_at: '2026-06-04T00:00:00Z',
    user: { id: 'u-4', name: '최현우', email: 'hyunwoo@example.com', account_type: 'freelancer' },
  },
  'u-5': {
    id: 'prof-5', user_id: 'u-5', bio: 'AI/ML 엔지니어. 자연어 처리 및 컴퓨터 비전 프로젝트 경험. LLM 기반 서비스 개발에 집중하고 있습니다.', avatar_url: null, location: '서울', website_url: null, github_url: null,
    skills: ['Python', 'TensorFlow', 'PyTorch', 'FastAPI', 'LangChain', 'OpenAI'], hourly_rate: '70,000원/h', experience_years: 6,
    portfolio_items: [], is_public: true, inserted_at: '2026-01-05T00:00:00Z', updated_at: '2026-06-05T00:00:00Z',
    user: { id: 'u-5', name: '정민서', email: 'minseo@example.com', account_type: 'freelancer' },
  },
  'u-6': {
    id: 'prof-6', user_id: 'u-6', bio: '풀스택 개발자. Vue.js와 Node.js 기반 SaaS 서비스 개발 전문. 빠른 MVP 개발과 반복적 개선에 능숙합니다.', avatar_url: null, location: '인천', website_url: null, github_url: null,
    skills: ['Vue.js', 'Node.js', 'TypeScript', 'PostgreSQL', 'Redis'], hourly_rate: '45,000원/h', experience_years: 4,
    portfolio_items: [], is_public: true, inserted_at: '2026-01-06T00:00:00Z', updated_at: '2026-06-06T00:00:00Z',
    user: { id: 'u-6', name: '한도윤', email: 'doyun@example.com', account_type: 'freelancer' },
  },
}

interface PublicProfileViewProps {
  userId: string
  token?: string | null
  onBack?: () => void
  onContactFreelancer?: (freelancerId: string) => void
  onInviteFreelancer?: (freelancerId: string, name: string) => void
}

export default function PublicProfileView({ userId, token, onBack, onContactFreelancer, onInviteFreelancer }: PublicProfileViewProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE}/api/profiles/${userId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const body = await readJsonResponse<{ data?: UserProfile; error?: string }>(res)
        if (cancelled) return
        if (!res.ok || !body?.data) {
          setProfile(DUMMY_PROFILES[userId] ?? null)
        } else {
          setProfile(body.data)
        }
      } catch {
        if (!cancelled) setProfile(DUMMY_PROFILES[userId] ?? null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [userId, token])

  const isFreelancer = profile?.user?.account_type === 'freelancer'

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="mb-3 flex justify-center" style={{ color: 'var(--color-text-muted)' }}><Loader2 className="w-10 h-10 animate-spin" /></div>
        <p style={{ color: 'var(--color-text-secondary)' }}>프로필을 불러오는 중...</p>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="text-center py-16">
        {onBack && (
          <button onClick={onBack} className="mb-4 px-4 py-2 rounded-full text-sm font-medium transition-all" style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}>
            ← 목록으로
          </button>
        )}
        <div className="mb-3 flex justify-center text-2xl" style={{ color: 'var(--color-text-muted)' }}>😕</div>
        <p style={{ color: 'var(--color-text-secondary)' }}>{error ?? '프로필을 찾을 수 없습니다.'}</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* 뒤로가기 */}
      {onBack && (
        <button onClick={onBack} className="mb-5 px-4 py-2 rounded-full text-sm font-medium transition-all" style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}>
          ← 목록으로
        </button>
      )}

      {/* 프로필 히어로 */}
      <div className="rounded-2xl overflow-hidden mb-6" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-card)' }}>
        <div className="p-8">
          <div className="flex gap-6 items-start flex-wrap">
            {/* 아바타 */}
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white shrink-0 overflow-hidden"
              style={{
                background: profile.avatar_url ? 'transparent' : 'linear-gradient(135deg, var(--color-primary), var(--color-starbucks-green))',
                border: '3px solid var(--color-bg-card)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.user?.name ?? ''}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                initials(profile.user?.name)
              )}
            </div>

            {/* 정보 */}
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h2 className="text-2xl font-bold m-0" style={{ color: 'var(--color-text)' }}>
                  {profile.user?.name ?? '이름 없음'}
                </h2>
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: isFreelancer ? 'var(--color-primary-light)' : 'var(--color-success-light)',
                    color: isFreelancer ? 'var(--color-primary)' : 'var(--color-success)',
                  }}
                >
                  {isFreelancer ? '프리랜서' : '클라이언트'}
                </span>
              </div>

              {profile.bio && (
                <p className="text-sm leading-relaxed mb-4 max-w-xl" style={{ color: 'var(--color-text-secondary)' }}>
                  {profile.bio}
                </p>
              )}

              <div className="flex flex-wrap gap-2 mb-4">
                {profile.location && (
                  <span className="text-sm flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}><MapPin className="w-4 h-4" /> {profile.location}</span>
                )}
                {profile.hourly_rate && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--color-primary)', background: 'var(--color-primary-light)' }}>
                    <DollarSign className="w-3 h-3" /> {profile.hourly_rate}
                  </span>
                )}
                {profile.experience_years != null && (
                  <span className="text-sm flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                    <Calendar className="w-4 h-4" /> 경력 {profile.experience_years}년
                  </span>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                {profile.website_url && (
                  <a href={profile.website_url} target="_blank" rel="noopener noreferrer"
                    className="px-4 py-2 rounded-full text-xs font-semibold transition-all"
                    style={{ color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}
                  >
                    <Globe className="w-4 h-4 inline" /> 웹사이트
                  </a>
                )}
                {profile.github_url && (
                  <a href={profile.github_url} target="_blank" rel="noopener noreferrer"
                    className="px-4 py-2 rounded-full text-xs font-semibold transition-all"
                    style={{ color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}
                  >
                    <CodeXml className="w-4 h-4 inline" /> GitHub
                  </a>
                )}
                {isFreelancer && onContactFreelancer && (
                  <button
                    onClick={() => onContactFreelancer(userId)}
                    className="px-4 py-2 rounded-full text-xs font-semibold text-white transition-all"
                    style={{ background: 'var(--color-primary)' }}
                  >
                    <MessageCircle className="w-4 h-4 inline" /> 채팅하기
                  </button>
                )}
                {isFreelancer && onInviteFreelancer && profile.user && (
                  <button
                    onClick={() => onInviteFreelancer(userId, profile.user!.name ?? '프리랜서')}
                    className="px-4 py-2 rounded-full text-xs font-semibold transition-all"
                    style={{ color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}
                  >
                    프로젝트에 초대
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 기술 스택 */}
      {isFreelancer && (profile.skills?.length ?? 0) > 0 && (
        <div className="rounded-2xl p-6 mb-6" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)' }}>
          <h3 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}><Wrench className="w-5 h-5" /> 기술 스택</h3>
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((s) => (
              <span key={s} className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 포트폴리오 */}
      {isFreelancer && (profile.portfolio_items?.length ?? 0) > 0 && (
        <div className="rounded-2xl p-6" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)' }}>
          <h3 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}><FolderOpen className="w-5 h-5" /> 포트폴리오</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profile.portfolio_items.map((item) => (
              <PortfolioCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PortfolioCard({ item }: { item: PortfolioItem }) {
  return (
    <div className="rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.02]"
      style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-light)' }}
    >
      {item.image_url && (
        <img
          src={item.image_url}
          alt={item.title}
          className="w-full h-36 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
      <div className="p-4">
        <div className="text-sm font-bold mb-1" style={{ color: 'var(--color-text)' }}>{item.title}</div>
        {item.description && (
          <div className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {item.description}
          </div>
        )}
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            className="text-xs mt-2 inline-block" style={{ color: 'var(--color-primary)' }}
          >
            <Link className="w-4 h-4 inline" /> 링크 보기
          </a>
        )}
      </div>
    </div>
  )
}

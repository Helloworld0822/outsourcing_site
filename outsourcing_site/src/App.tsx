import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import {
  ThemeProvider,
  BaseStyles,
  Heading,
  Text,
  Button,
  TextInput,
  Avatar,
} from '@primer/react'
import './App.css'
import LoginPanel from './LoginPanel'
import heroImage from './assets/hero.png'

type Project = {
  id: string
  title: string
  description: string
  skills: string[]
  budget: string
  client: { name: string; avatar?: string }
  productImage?: string
}

const mockProjects: Project[] = [
  {
    id: 'p1',
    title: '모바일 앱용 결제 화면 디자인 및 구현',
    description: '결제 플로우와 UI/UX 개선, React로 구현 가능한 컴포넌트 제공',
    skills: ['React', 'TypeScript', 'Design'],
    budget: '₩1,200,000',
    client: { name: '스타트업 A' },
    productImage: heroImage,
  },
  {
    id: 'p2',
    title: '콘텐츠 관리 CMS 구축',
    description: '간단한 관리자 페이지와 API 연동, 인증 포함',
    skills: ['React', 'Node', 'REST API'],
    budget: '₩2,500,000',
    client: { name: '미디어 B' },
    productImage: heroImage,
  },
  {
    id: 'p3',
    title: '프로토타입: 이커머스 카탈로그',
    description: '검색/필터, 제품 카드, 반응형 레이아웃',
    skills: ['React', 'CSS', 'Accessibility'],
    budget: '₩900,000',
    client: { name: '샵 C' },
    productImage: heroImage,
  },
]

function ProjectCard({ p }: { p: Project }) {
  const productImage = p.productImage ?? heroImage
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: 12,
        backgroundColor: 'var(--code-bg)',
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <Heading as="h3" style={{ fontSize: 20, margin: 0 }}>
            {p.title}
          </Heading>
          <Text color="fg.muted" style={{ marginTop: 8, display: 'inline-block' }}>
            {p.description}
          </Text>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {p.skills.map((s) => (
              <span
                key={s}
                style={{
                  display: 'inline-block',
                  fontSize: 12,
                  border: '1px solid var(--border)',
                  borderRadius: 999,
                  padding: '2px 8px',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 160 }}>
          <Text style={{ fontWeight: 'bold' }}>{p.budget}</Text>
          <div style={{ marginTop: 8 }}>
            <img
              src={productImage}
              alt={`${p.title} 상품 이미지`}
              style={{
                width: 140,
                height: 90,
                objectFit: 'cover',
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <Button variant="primary">외주 제안하기</Button>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar alt={p.client.name} src={p.client.avatar ?? '/favicon.svg'} />
        <Text>{p.client.name}</Text>
      </div>
    </div>
  )
}

export default function App() {
  const [query, setQuery] = useState('')
  const [skillFilter, setSkillFilter] = useState<string | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(localStorage.getItem('token')))
  const [colorMode, setColorMode] = useState<'day' | 'night'>(() => {
    const stored = localStorage.getItem('colorMode')
    return stored === 'night' ? 'night' : 'day'
  })

  useEffect(() => {
    localStorage.setItem('colorMode', colorMode)
    document.documentElement.setAttribute('data-color-mode', colorMode)
  }, [colorMode])

  const skills = useMemo(() => {
    const s = new Set<string>()
    mockProjects.forEach((p) => p.skills.forEach((k) => s.add(k)))
    return Array.from(s)
  }, [])

  const filtered = useMemo(() => {
    return mockProjects.filter((p) => {
      const matchesQuery = query.trim() === '' || p.title.includes(query) || p.description.includes(query)
      const matchesSkill = !skillFilter || p.skills.includes(skillFilter)
      return matchesQuery && matchesSkill
    })
  }, [query, skillFilter])

  return (
    <ThemeProvider colorMode={colorMode}>
      <BaseStyles>
        <div style={{padding: 16}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
            <div>
              <Heading as="h1">Outsourcing Hub</Heading>
              <Text color="fg.muted">프리랜서와 클라이언트를 연결하는 외주 중개 플랫폼 (Primer 스타일)</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button
                variant="invisible"
                onClick={() => setColorMode((prev) => (prev === 'day' ? 'night' : 'day'))}
              >
                {colorMode === 'day' ? '다크 모드' : '화이트 모드'}
              </Button>
              {!isLoggedIn ? (
                <Button variant="invisible" onClick={() => setShowLogin(true)}>로그인</Button>
              ) : (
                <Button variant="invisible" onClick={() => { localStorage.removeItem('token'); setIsLoggedIn(false); }}>로그아웃</Button>
              )}
              <Button variant="primary">회원가입</Button>
            </div>
          </div>

          {showLogin && !isLoggedIn && (
            <div style={{ marginBottom: 16 }}>
              <LoginPanel
                onLogin={() => {
                  setIsLoggedIn(true)
                  setShowLogin(false)
                }}
              />
            </div>
          )}

          <div style={{display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16}}>
            <div>
              <div style={{border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--bg)'}}>
                <Heading as="h2">검색</Heading>
                <div style={{marginTop: 8}}>
                  <label>프로젝트 검색</label>
                  <TextInput
                    placeholder="검색어를 입력하세요 (예: React)"
                    value={query}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                  />
                </div>

                <div style={{marginTop: 12}}>
                  <Heading as="h3">기술 필터</Heading>
                  <div>
                    {['(전체)', ...skills].map((s) => (
                      <div key={s} style={{padding: 6, cursor: 'pointer'}} onClick={() => setSkillFilter(s === '(전체)' ? null : s)}>
                        {s} {skillFilter === s || (s === '(전체)' && skillFilter === null) ? '•' : ''}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{marginTop: 12}}>
                  <Heading as="h3">Top 클라이언트</Heading>
                  <div style={{display: 'flex', gap: 8, marginTop: 8}}>
                    <Avatar src="/favicon.svg" alt="Client A" />
                    <Avatar src="/favicon.svg" alt="Client B" />
                    <Avatar src="/favicon.svg" alt="Client C" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div style={{borderRadius: 8, padding: 16, background: 'var(--code-bg)', marginBottom: 16}}>
                <Heading as="h2">프로젝트 찾기</Heading>
                <Text color="fg.muted" style={{marginTop: 8}}>
                  수많은 외주 프로젝트 중에서 원하는 기술과 예산으로 빠르게 매칭하세요.
                </Text>

                <div style={{marginTop: 12, display: 'flex', gap: 8}}>
                  <Button variant="primary">프로젝트 등록</Button>
                  <Button variant="default">프리랜서 보기</Button>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div>
                  <Text>검색 결과가 없습니다.</Text>
                </div>
              ) : (
                filtered.map((p) => <ProjectCard key={p.id} p={p} />)
              )}
            </div>
          </div>

          <footer style={{marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 16}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <Text color="fg.muted">© {new Date().getFullYear()} Outsourcing Hub</Text>
              <div>
                <Button variant="invisible">회사정보</Button>
                <Button variant="invisible">약관</Button>
              </div>
            </div>
          </footer>
        </div>
      </BaseStyles>
    </ThemeProvider>
  )
}

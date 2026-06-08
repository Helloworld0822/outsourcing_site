import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
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
import SignUpPanel from './SignUpPanel'
import AiRecommend from './AiRecommend'
import FreelancerServiceForm, { type FreelancerService } from './FreelancerServiceForm'
import FreelancerServiceList from './FreelancerServiceList'
import ServiceOrderDialog from './ServiceOrderDialog'
import NotificationBell from './NotificationBell'
import heroImage from './assets/hero.png'
import { API_BASE } from './apiBase'
import { readJsonResponse, formatError } from './http'

type AccountType = 'client' | 'freelancer'

type SessionUser = {
  id: string
  email: string
  name: string
  account_type: AccountType
}

type Session = {
  token: string
  user: SessionUser
}

type Application = {
  id: string
  project_id: string
  freelancer_id: string
  message: string
  status: string
  freelancer: SessionUser
  project?: { id: string; title: string }
  inserted_at: string | null
  updated_at: string | null
}

type Project = {
  id: string
  title: string
  description: string
  skills: string[]
  budget: string
  client_name: string | null
  client_id?: string | null
  inserted_at: string | null
  updated_at: string | null
  applications?: Application[]
}

type ProjectForm = {
  title: string
  description: string
  skills: string
  budget: string
}

type ProjectCardProps = {
  project: Project
  role: AccountType | null
  draft: string
  onDraftChange: (projectId: string, value: string) => void
  onApply: (projectId: string) => void
  showApplications: boolean
}

function splitSkills(value: string) {
  return value
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean)
}

function ProjectCard({ project, role, draft, onDraftChange, onApply, showApplications }: ProjectCardProps) {
  const clientName = project.client_name || '익명 클라이언트'

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
        <div style={{ flex: 1 }}>
          <Heading as="h3" style={{ fontSize: 20, margin: 0 }}>
            {project.title}
          </Heading>
          <Text color="fg.muted" style={{ marginTop: 8, display: 'inline-block' }}>
            {project.description || '설명이 없습니다.'}
          </Text>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {project.skills.map((s) => (
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
          <Text style={{ fontWeight: 'bold' }}>{project.budget || '예산 미정'}</Text>
          <div style={{ marginTop: 8 }}>
            <img
              src={heroImage}
              alt={`${project.title} 이미지`}
              style={{
                width: 140,
                height: 90,
                objectFit: 'cover',
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar alt={clientName} src="/favicon.svg" />
        <Text>{clientName}</Text>
      </div>

      {role === 'freelancer' && !showApplications && (
        <div style={{ marginTop: 12 }}>
          <label>지원 메시지</label>
          <textarea
            value={draft}
            onChange={(e) => onDraftChange(project.id, e.target.value)}
            rows={3}
            style={{
              width: '100%',
              marginTop: 6,
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'inherit',
              resize: 'vertical',
            }}
            placeholder="프로젝트에 지원할 내용을 적어주세요."
          />
          <div style={{ marginTop: 8 }}>
            <Button variant="primary" onClick={() => onApply(project.id)}>
              지원하기
            </Button>
          </div>
        </div>
      )}

      {showApplications && (
        <div style={{ marginTop: 12 }}>
          <Heading as="h4" style={{ fontSize: 16, marginBottom: 8 }}>
            받은 지원
          </Heading>
          {(project.applications?.length || 0) === 0 ? (
            <Text color="fg.muted">아직 지원이 없습니다.</Text>
          ) : (
            project.applications?.map((application) => (
              <div
                key={application.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 8,
                  background: 'var(--bg)',
                }}
              >
                <Text style={{ fontWeight: 'bold' }}>{application.freelancer.name}</Text>
                <Text color="fg.muted" style={{ display: 'block', marginTop: 4 }}>
                  {application.freelancer.email}
                </Text>
                <Text style={{ display: 'block', marginTop: 8 }}>{application.message}</Text>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [query, setQuery] = useState('')
  const [skillFilter, setSkillFilter] = useState<string | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [showSignup, setShowSignup] = useState(false)
  const [view, setView] = useState<'projects' | 'services'>('projects')
  const [servicesRefreshKey, setServicesRefreshKey] = useState(0)
  const [orderTarget, setOrderTarget] = useState<FreelancerService | null>(null)
  const [session, setSession] = useState<Session | null>(() => {
    const token = localStorage.getItem('token')
    const user = localStorage.getItem('user')

    if (!token || !user) return null

    try {
      return { token, user: JSON.parse(user) as SessionUser }
    } catch {
      return null
    }
  })
  const [colorMode, setColorMode] = useState<'day' | 'night'>(() => {
    const stored = localStorage.getItem('colorMode')
    if (stored === 'night' || stored === 'day') {
      return stored
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day'
  })
  const [publicProjects, setPublicProjects] = useState<Project[]>([])
  const [clientProjects, setClientProjects] = useState<Project[]>([])
  const [freelancerApplications, setFreelancerApplications] = useState<Application[]>([])
  const [projectForm, setProjectForm] = useState<ProjectForm>({
    title: '',
    description: '',
    skills: '',
    budget: '',
  })
  const [applicationDrafts, setApplicationDrafts] = useState<Record<string, string>>({})
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [loadingPublic, setLoadingPublic] = useState(false)
  const [loadingPrivate, setLoadingPrivate] = useState(false)

  const role = session?.user.account_type ?? null
  const isLoggedIn = Boolean(session)

  useEffect(() => {
    localStorage.setItem('colorMode', colorMode)
    document.documentElement.dataset.theme = colorMode
    document.documentElement.style.colorScheme = colorMode === 'night' ? 'dark' : 'light'
  }, [colorMode])

  useEffect(() => {
    if (session) {
      localStorage.setItem('token', session.token)
      localStorage.setItem('user', JSON.stringify(session.user))
    } else {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }, [session])

  const skills = useMemo(() => {
    const s = new Set<string>()
    publicProjects.forEach((p) => p.skills.forEach((k) => s.add(k)))
    return Array.from(s)
  }, [publicProjects])

  const filteredProjects = useMemo(() => {
    return publicProjects.filter((p) => {
      const matchesQuery = query.trim() === '' || p.title.includes(query) || p.description.includes(query)
      const matchesSkill = !skillFilter || p.skills.includes(skillFilter)
      return matchesQuery && matchesSkill
    })
  }, [publicProjects, query, skillFilter])

  const apiRequest = useCallback(
    async <T,>(path: string, init: RequestInit = {}, auth = false): Promise<T> => {
      const headers = new Headers(init.headers)
      headers.set('Content-Type', 'application/json')

      if (auth && session?.token) {
        headers.set('Authorization', `Bearer ${session.token}`)
      }

      const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers,
      })

      const body = await readJsonResponse<T>(res)
      if (!res.ok) {
        throw new Error(formatError((body as { error?: unknown } | null)?.error, '요청 실패'))
      }

      return (body ?? ({} as T)) as T
    },
    [session],
  )

  const loadPublicProjects = useCallback(async () => {
    setLoadingPublic(true)
    try {
      const body = await apiRequest<{ data: Project[] }>('/api/projects')
      setPublicProjects(body.data)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '프로젝트를 불러오지 못했습니다.')
    } finally {
      setLoadingPublic(false)
    }
  }, [apiRequest])

  const loadClientProjects = useCallback(async () => {
    setLoadingPrivate(true)
    try {
      const body = await apiRequest<{ data: Project[] }>('/api/client/projects', {}, true)
      setClientProjects(body.data)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '내 프로젝트를 불러오지 못했습니다.')
    } finally {
      setLoadingPrivate(false)
    }
  }, [apiRequest])

  const loadFreelancerApplications = useCallback(async () => {
    setLoadingPrivate(true)
    try {
      const body = await apiRequest<{ data: Application[] }>('/api/freelancer/applications', {}, true)
      setFreelancerApplications(body.data)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '지원 내역을 불러오지 못했습니다.')
    } finally {
      setLoadingPrivate(false)
    }
  }, [apiRequest])

  useEffect(() => {
    // Initial fetch of the public project list. The state updates happen
    // asynchronously inside `loadPublicProjects`, so this is safe.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPublicProjects()
  }, [loadPublicProjects])

  useEffect(() => {
    // Resetting role-scoped state when the session changes is the
    // correct behaviour here: each role reads from a different endpoint,
    // and we don't want the previous user's projects/applications to
    // flash in after a logout/login cycle.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!session) {
      setClientProjects([])
      setFreelancerApplications([])
      return
    }

    if (session.user.account_type === 'client') {
      loadClientProjects()
      setFreelancerApplications([])
      return
    }

    if (session.user.account_type === 'freelancer') {
      loadFreelancerApplications()
      setClientProjects([])
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [session, loadClientProjects, loadFreelancerApplications])

  function handleSession(sessionValue: Session) {
    setSession(sessionValue)
    setShowLogin(false)
    setShowSignup(false)
    setStatusMessage('로그인되었습니다.')
  }

  function handleLogout() {
    setSession(null)
    setShowLogin(false)
    setShowSignup(false)
    setStatusMessage('로그아웃되었습니다.')
  }

  async function createProject() {
    if (!session || role !== 'client') return

    try {
      const body = await apiRequest<{ data: Project }>(
        '/api/projects',
        {
          method: 'POST',
          body: JSON.stringify({
            title: projectForm.title,
            description: projectForm.description,
            skills: splitSkills(projectForm.skills),
            budget: projectForm.budget,
          }),
        },
        true,
      )

      setPublicProjects((prev) => [body.data, ...prev])
      setClientProjects((prev) => [body.data, ...prev])
      setProjectForm({ title: '', description: '', skills: '', budget: '' })
      setStatusMessage('프로젝트를 생성했습니다.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '프로젝트 생성에 실패했습니다.')
    }
  }

  async function applyToProject(projectId: string) {
    if (!session || role !== 'freelancer') return

    const message = applicationDrafts[projectId]?.trim()
    if (!message) {
      setStatusMessage('지원 메시지를 입력해주세요.')
      return
    }

    try {
      const body = await apiRequest<{ data: Application }>(
        `/api/projects/${projectId}/applications`,
        {
          method: 'POST',
          body: JSON.stringify({ message }),
        },
        true,
      )

      setFreelancerApplications((prev) => [body.data, ...prev])
      setApplicationDrafts((prev) => ({ ...prev, [projectId]: '' }))
      setStatusMessage('프로젝트에 지원했습니다.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '지원에 실패했습니다.')
    }
  }

  return (
    <ThemeProvider colorMode={colorMode}>
      <BaseStyles>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 16 }}>
            <div>
              <Heading as="h1">Outsourcing Hub</Heading>
              <Text color="fg.muted">프리랜서와 클라이언트를 연결하는 외주 중개 플랫폼 (Primer 스타일)</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {['projects', 'services'].map((v) => {
                const active = view === v
                const label = v === 'projects' ? '프로젝트' : '서비스'
                return (
                  <button
                    key={v}
                    onClick={() => setView(v as 'projects' | 'services')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'var(--accent)' : 'transparent',
                      color: active ? 'white' : 'inherit',
                      cursor: 'pointer',
                      fontWeight: active ? 'bold' : 'normal',
                      fontSize: 13,
                    }}
                  >
                    {label}
                  </button>
                )
              })}
              <div style={{ width: 8 }} />
              <Button
                variant="invisible"
                aria-pressed={colorMode === 'night'}
                onClick={() => setColorMode((prev) => (prev === 'day' ? 'night' : 'day'))}
              >
                {colorMode === 'day' ? '다크 모드' : '화이트 모드'}
              </Button>
              {session && (
                <NotificationBell token={session.token} />
              )}
              {!isLoggedIn ? (
                <Button variant="invisible" onClick={() => setShowLogin((s) => !s)}>
                  {showLogin ? '로그인 닫기' : '로그인'}
                </Button>
              ) : (
                <Button variant="invisible" onClick={handleLogout}>
                  로그아웃
                </Button>
              )}
              <Button variant="primary" onClick={() => setShowSignup(true)}>
                회원가입
              </Button>
            </div>
          </div>

          {statusMessage && (
            <div style={{ marginBottom: 16 }}>
              <Text>{statusMessage}</Text>
            </div>
          )}

          {showLogin && !isLoggedIn && (
            <div style={{ marginBottom: 16 }}>
              <LoginPanel onLogin={handleSession} />
            </div>
          )}

          {showSignup && !isLoggedIn && (
            <SignUpPanel
              onSignUp={handleSession}
              onClose={() => setShowSignup(false)}
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
            <div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--bg)' }}>
                <Heading as="h2">검색</Heading>
                <div style={{ marginTop: 8 }}>
                  <label>프로젝트 검색</label>
                  <TextInput
                    placeholder="검색어를 입력하세요 (예: React)"
                    value={query}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                  />
                </div>

                <div style={{ marginTop: 12 }}>
                  <Heading as="h3">기술 필터</Heading>
                  <div>
                    {['(전체)', ...skills].map((s) => (
                      <div key={s} style={{ padding: 6, cursor: 'pointer' }} onClick={() => setSkillFilter(s === '(전체)' ? null : s)}>
                        {s} {skillFilter === s || (s === '(전체)' && skillFilter === null) ? '•' : ''}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              {view === 'projects' ? (
                <>
              <div style={{ borderRadius: 8, padding: 16, background: 'var(--code-bg)', marginBottom: 16 }}>
                <Heading as="h2">프로젝트 찾기</Heading>
                <Text color="fg.muted" style={{ marginTop: 8 }}>
                  원하는 프로젝트를 찾고, 프리랜서는 바로 지원하고, 클라이언트는 새 프로젝트를 올릴 수 있습니다.
                </Text>
              </div>

              {role === 'client' && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16, background: 'var(--bg)' }}>
                  <Heading as="h3">프로젝트 생성</Heading>
                  <div style={{ marginTop: 8 }}>
                    <label>제목</label>
                    <TextInput
                      value={projectForm.title}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setProjectForm((prev) => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label>설명</label>
                    <textarea
                      value={projectForm.description}
                      onChange={(e) => setProjectForm((prev) => ({ ...prev, description: e.target.value }))}
                      rows={4}
                      style={{
                        width: '100%',
                        marginTop: 6,
                        padding: 10,
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'inherit',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                    <div>
                      <label>기술 스택</label>
                      <TextInput
                        placeholder="React, TypeScript"
                        value={projectForm.skills}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setProjectForm((prev) => ({ ...prev, skills: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label>예산</label>
                      <TextInput
                        placeholder="₩1,000,000"
                        value={projectForm.budget}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setProjectForm((prev) => ({ ...prev, budget: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <Button variant="primary" onClick={createProject} disabled={loadingPrivate}>
                      프로젝트 생성
                    </Button>
                  </div>
                </div>
              )}

              {role === 'client' && (
                <div style={{ marginBottom: 16 }}>
                  <Heading as="h3">내 프로젝트</Heading>
                  {loadingPrivate ? <Text>불러오는 중...</Text> : clientProjects.length === 0 ? <Text>아직 생성한 프로젝트가 없습니다.</Text> : clientProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      role={role}
                      draft=""
                      onDraftChange={() => undefined}
                      onApply={() => undefined}
                      showApplications
                    />
                  ))}
                </div>
              )}

              {role === 'freelancer' && (
                <>
                  <AiRecommend token={session?.token ?? null} />

                  <div style={{ marginBottom: 16 }}>
                    <Heading as="h3">내 수주 현황</Heading>
                    {loadingPrivate ? (
                      <Text>불러오는 중...</Text>
                    ) : freelancerApplications.length === 0 ? (
                      <Text color="fg.muted">아직 지원한 프로젝트가 없습니다.</Text>
                    ) : (
                      freelancerApplications.map((application) => {
                        const statusLabel: Record<string, string> = {
                          pending: '검토 중',
                          accepted: '수주 확정',
                          rejected: '미선정',
                        }
                        const statusColor: Record<string, string> = {
                          pending: '#f59e0b',
                          accepted: '#10b981',
                          rejected: '#ef4444',
                        }
                        const st = application.status
                        return (
                          <div
                            key={application.id}
                            style={{
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              padding: 12,
                              marginTop: 8,
                              background: 'var(--bg)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <Text style={{ fontWeight: 'bold', fontSize: 15 }}>
                                {application.project?.title ?? '프로젝트'}
                              </Text>
                              <span style={{
                                fontSize: 12,
                                padding: '2px 8px',
                                borderRadius: 999,
                                border: `1px solid ${statusColor[st] ?? '#888'}`,
                                color: statusColor[st] ?? '#888',
                                whiteSpace: 'nowrap',
                              }}>
                                {statusLabel[st] ?? st}
                              </span>
                            </div>
                            <Text color="fg.muted" style={{ display: 'block', marginTop: 6, fontSize: 14 }}>
                              {application.message}
                            </Text>
                            {application.inserted_at && (
                              <Text color="fg.muted" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                                지원일: {new Date(application.inserted_at).toLocaleDateString('ko-KR')}
                              </Text>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </>
              )}

              <div>
                <Heading as="h3">전체 프로젝트</Heading>
                {loadingPublic ? (
                  <Text>불러오는 중...</Text>
                ) : filteredProjects.length === 0 ? (
                  <Text>검색 결과가 없습니다.</Text>
                ) : (
                  filteredProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      role={role}
                      draft={applicationDrafts[project.id] || ''}
                      onDraftChange={(projectId, value) =>
                        setApplicationDrafts((prev) => ({
                          ...prev,
                          [projectId]: value,
                        }))
                      }
                      onApply={applyToProject}
                      showApplications={false}
                    />
                  ))
                )}
              </div>
                </>
              ) : (
                <>
                  {role === 'freelancer' && session && (
                    <FreelancerServiceForm
                      token={session.token}
                      onCreated={() => {
                        setServicesRefreshKey((k) => k + 1)
                        setStatusMessage('서비스가 등록되었습니다.')
                      }}
                    />
                  )}
                  <FreelancerServiceList
                    token={session?.token ?? null}
                    refreshKey={servicesRefreshKey}
                    onOrder={(svc) => {
                      if (!session) {
                        setShowLogin(true)
                        setStatusMessage('주문하려면 로그인이 필요합니다.')
                        return
                      }
                      if (role !== 'client') {
                        setStatusMessage('서비스 주문은 클라이언트 계정만 가능합니다.')
                        return
                      }
                      setOrderTarget(svc)
                    }}
                  />
                </>
              )}

              {orderTarget && session && (
                <ServiceOrderDialog
                  service={orderTarget}
                  token={session.token}
                  onClose={() => setOrderTarget(null)}
                  onOrdered={() => setStatusMessage('주문이 접수되었습니다.')}
                />
              )}
            </div>
          </div>

          <footer style={{ marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text color="fg.muted">© {new Date().getFullYear()} Outsourcing Hub</Text>
              <div style={{ display: 'flex', gap: 4 }}>
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

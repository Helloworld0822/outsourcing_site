import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import {
  ThemeProvider,
  BaseStyles,
} from '@primer/react'
import './App.css'
import LoginPanel from './auth/LoginPanel'
import SignUpPanel from './auth/SignUpPanel'
import AiRecommend from './ai/AiRecommend'
import FreelancerServiceForm from './services/FreelancerServiceForm'
import type { FreelancerService } from './services/types'
import FreelancerServiceList from './services/FreelancerServiceList'
import ServiceOrderDialog from './services/ServiceOrderDialog'
import NotificationBell from './notifications/NotificationBell'
import ChatWidget from './chat/ChatWidget'
import VerifyEmail from './auth/VerifyEmail'
import { API_BASE } from './api/apiBase'
import ProfilePage from './profile/ProfilePage'
import FreelancerList from './profile/FreelancerList'
import PublicProfileView from './profile/PublicProfileView'
import ProjectCard from './projects/ProjectCard'
import type { Project, Application, ProjectForm } from './projects/types'
import { splitSkills } from './projects/types'
import {
  readJsonResponse,
  formatHttpError,
  getStoredToken,
  getStoredRefreshToken,
  getStoredUser,
  setSession as persistSession,
  clearSession as clearPersistedSession,
} from './api/http'
import type { Session } from './api/types'

export default function App() {
  const [query, setQuery] = useState('')
  const [skillFilter, setSkillFilter] = useState<string | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [showSignup, setShowSignup] = useState(false)
  const [verifyEmailToken, setVerifyEmailToken] = useState<string | null>(null)
  const [view, setView] = useState<'projects' | 'services' | 'ai' | 'profile' | 'freelancers'>('projects')
  const [servicesRefreshKey, setServicesRefreshKey] = useState(0)
  const [selectedFreelancerId, setSelectedFreelancerId] = useState<string | null>(null)
  const [orderTarget, setOrderTarget] = useState<FreelancerService | null>(null)
  const [session, setSession] = useState<Session | null>(() => {
    const token = getStoredToken()
    const refresh_token = getStoredRefreshToken()
    const user = getStoredUser()

    if (!token || !refresh_token || !user) return null

    return { token, refresh_token, user }
  })
  const [colorMode, setColorMode] = useState<'day' | 'night'>(() => {
    const stored = localStorage.getItem('colorMode')
    if (stored === 'night' || stored === 'day') {
      return stored
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day'
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token && window.location.pathname === '/verify-email') {
      setVerifyEmailToken(token)
    }
  }, [])

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
      persistSession(session)
    } else {
      clearPersistedSession()
    }
  }, [session])

  useEffect(() => {
    if (!statusMessage) return
    const timer = setTimeout(() => setStatusMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [statusMessage])

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

  const tryRefresh = useCallback(async (): Promise<boolean> => {
    const refreshToken = session?.refresh_token ?? getStoredRefreshToken()
    if (!refreshToken) return false

    try {
      const res = await fetch(`${API_BASE}/api/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!res.ok) return false
      const body = (await readJsonResponse<{ token: string; refresh_token: string }>(res))
      if (!body?.token || !body.refresh_token) return false

      setSession((prev) => (prev ? { ...prev, token: body.token, refresh_token: body.refresh_token } : prev))
      return true
    } catch {
      return false
    }
  }, [session?.refresh_token])

  const apiRequest = useCallback(
    async <T,>(path: string, init: RequestInit = {}, auth = false): Promise<T> => {
      const headers: Record<string, string> = {}
      const incoming = init.headers
      if (incoming) {
        if (incoming instanceof Headers) {
          incoming.forEach((value, key) => {
            headers[key] = value
          })
        } else if (Array.isArray(incoming)) {
          incoming.forEach(([key, value]) => {
            headers[key] = value
          })
        } else {
          Object.assign(headers, incoming as Record<string, string>)
        }
      }
      if (init.body && !(init.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json'
      }
      if (auth) {
        const token = session?.token ?? getStoredToken()
        if (token) headers['Authorization'] = `Bearer ${token}`
      }

      const doFetch = async (overrideToken?: string | null): Promise<Response> => {
        const finalHeaders = { ...headers }
        if (auth) {
          const t = overrideToken ?? session?.token ?? getStoredToken()
          if (t) finalHeaders['Authorization'] = `Bearer ${t}`
          else delete finalHeaders['Authorization']
        }
        return fetch(`${API_BASE}${path}`, { ...init, headers: finalHeaders })
      }

      let res = await doFetch()

      if (res.status === 401 && auth) {
        const refreshed = await tryRefresh()
        if (refreshed) {
          const newToken = getStoredToken()
          setSession((prev) => (prev && newToken ? { ...prev, token: newToken } : prev))
          res = await doFetch()
        }
      }

      const body = await readJsonResponse<T>(res)
      if (!res.ok) {
        if (res.status === 401 && auth) {
          setSession(null)
        }
        const err = (body as { error?: unknown } | null)?.error
        const retryAfter = res.headers.get('retry-after')
        throw new Error(formatHttpError(res.status, retryAfter, err))
      }

      return (body ?? ({} as T)) as T
    },
    [session, tryRefresh],
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
    loadPublicProjects()
  }, [loadPublicProjects])

  useEffect(() => {
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
        <div className="app-container">
          {/* Header */}
          <header className="app-header">
            <div className="app-header-left">
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>O</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.01em' }}>Outsourcing Hub</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.2 }}>외주 중개 플랫폼</div>
              </div>
            </div>
            <div className="app-header-right">
              <div className="tab-group">
                {(['projects', 'services', 'freelancers', 'ai'] as const).map((v) => (
                  <button
                    key={v}
                    className={`tab-item ${view === v ? 'active' : ''}`}
                    onClick={() => setView(v)}
                  >
                    {v === 'projects' ? '프로젝트' : v === 'services' ? '서비스' : v === 'freelancers' ? '프리랜서' : 'AI 추천'}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => setColorMode((prev) => (prev === 'day' ? 'night' : 'day'))}
                style={{ fontSize: 13 }}
              >
                {colorMode === 'day' ? '🌙' : '☀️'}
              </button>
              {session && (
                <NotificationBell token={session.token} refreshToken={session.refresh_token} />
              )}
              {session ? (
                <>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setView('profile')}
                    style={{ fontSize: 13 }}
                    title="내 프로필"
                  >
                    👤 {session.user.name}
                  </button>
                  <button className="btn btn-ghost" onClick={handleLogout}>
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={() => setShowLogin((s) => !s)}>
                    로그인
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowSignup(true)}>
                    회원가입
                  </button>
                </>
              )}
            </div>
          </header>

          {/* Login Panel */}
          {showLogin && !isLoggedIn && (
            <div style={{ marginBottom: 20 }}>
              <LoginPanel onLogin={handleSession} onClose={() => setShowLogin(false)} />
            </div>
          )}

          {/* Signup Modal */}
          {showSignup && !isLoggedIn && (
            <SignUpPanel onClose={() => setShowSignup(false)} />
          )}

          {/* Main Content */}
          <div className="app-main">
            {/* Sidebar */}
            <aside className="app-sidebar">
              <div className="card">
                <div className="card-body">
                  <div className="section-title">🔍 검색</div>
                  <div style={{ marginTop: 8 }}>
                    <label className="form-label">프로젝트 검색</label>
                    <input
                      className="form-input"
                      placeholder="검색어를 입력하세요"
                      value={query}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                    />
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <div className="section-title">기술 필터</div>
                    <div style={{ marginTop: 4 }}>
                      <div
                        className={`skill-filter-item ${skillFilter === null ? 'active' : ''}`}
                        onClick={() => setSkillFilter(null)}
                      >
                        전체
                      </div>
                      {skills.map((s) => (
                        <div
                          key={s}
                          className={`skill-filter-item ${skillFilter === s ? 'active' : ''}`}
                          onClick={() => setSkillFilter(s)}
                        >
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            {/* Content */}
            <main className="app-content">
              {view === 'projects' ? (
                <>
                  {/* Hero */}
                  <div className="hero-banner">
                    <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>프로젝트 찾기</h2>
                    <p style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 13, margin: '6px 0 0' }}>
                      원하는 프로젝트를 찾고 바로 지원하세요. 프리랜서와 클라이언트를 연결합니다.
                    </p>
                  </div>

                  {/* Client: Create Project */}
                  {role === 'client' && (
                    <div className="card" style={{ marginBottom: 16 }}>
                      <div className="card-header">
                        <div className="section-title" style={{ margin: 0 }}>프로젝트 생성</div>
                      </div>
                      <div className="card-body">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div>
                            <label className="form-label">제목</label>
                            <input
                              className="form-input"
                              value={projectForm.title}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => setProjectForm((prev) => ({ ...prev, title: e.target.value }))}
                              placeholder="프로젝트 제목을 입력하세요"
                            />
                          </div>
                          <div>
                            <label className="form-label">설명</label>
                            <textarea
                              className="form-textarea"
                              value={projectForm.description}
                              onChange={(e) => setProjectForm((prev) => ({ ...prev, description: e.target.value }))}
                              rows={4}
                              placeholder="프로젝트 설명을 입력하세요"
                            />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                              <label className="form-label">기술 스택</label>
                              <input
                                className="form-input"
                                placeholder="React, TypeScript"
                                value={projectForm.skills}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setProjectForm((prev) => ({ ...prev, skills: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="form-label">예산</label>
                              <input
                                className="form-input"
                                placeholder="1,000,000원"
                                value={projectForm.budget}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setProjectForm((prev) => ({ ...prev, budget: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div>
                            <button className="btn btn-primary" onClick={createProject} disabled={loadingPrivate}>
                              프로젝트 생성
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Client: My Projects */}
                  {role === 'client' && (
                    <div style={{ marginBottom: 20 }}>
                      <div className="section-title">📁 내 프로젝트</div>
                      {loadingPrivate ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>불러오는 중...</p>
                      ) : clientProjects.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>아직 생성한 프로젝트가 없습니다.</p>
                      ) : (
                        clientProjects.map((project) => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            role={role}
                            draft=""
                            onDraftChange={() => undefined}
                            onApply={() => undefined}
                            showApplications
                          />
                        ))
                      )}
                    </div>
                  )}

                  {/* Freelancer: My Applications */}
                  {role === 'freelancer' && (
                    <>
                      <div style={{ marginBottom: 20 }}>
                        <div className="section-title">📋 내 수주 현황</div>
                        {loadingPrivate ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>불러오는 중...</p>
                        ) : freelancerApplications.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>아직 지원한 프로젝트가 없습니다.</p>
                        ) : (
                          freelancerApplications.map((application) => {
                            const statusLabel: Record<string, string> = {
                              pending: '검토 중',
                              accepted: '수주 확정',
                              rejected: '미선정',
                            }
                            const st = application.status
                            return (
                              <div key={application.id} className="card" style={{ marginBottom: 8 }}>
                                <div className="card-body" style={{ padding: 14 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                                      {application.project?.title ?? '프로젝트'}
                                    </div>
                                    <span className={`status-badge status-${st}`}>
                                      {statusLabel[st] ?? st}
                                    </span>
                                  </div>
                                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
                                    {application.message}
                                  </p>
                                  {application.inserted_at && (
                                    <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 6 }}>
                                      지원일: {new Date(application.inserted_at).toLocaleDateString('ko-KR')}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </>
                  )}

                  {/* All Projects */}
                  <div>
                    <div className="section-title">🌐 전체 프로젝트</div>
                    {loadingPublic ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>불러오는 중...</p>
                    ) : filteredProjects.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-state-icon">📭</div>
                        <p>검색 결과가 없습니다.</p>
                      </div>
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
              ) : view === 'services' ? (
                /* Services View */
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
              ) : view === 'freelancers' ? (
                /* Freelancers View */
                <>
                  <div className="hero-banner">
                    <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>프리랜서 찾기</h2>
                    <p style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 13, margin: '6px 0 0' }}>
                      원하는 기술을 보유한 프리랜서를 찾아 바로 연락해보세요.
                    </p>
                  </div>
                  {selectedFreelancerId ? (
                    <PublicProfileView
                      userId={selectedFreelancerId}
                      token={session?.token ?? null}
                      onBack={() => setSelectedFreelancerId(null)}
                      onContactFreelancer={(_id) => {
                        if (!session) { setShowLogin(true); return }
                        // TODO: open chat
                        setStatusMessage(`프리랜서에게 채팅을 요청했습니다.`)
                      }}
                    />
                  ) : (
                    <FreelancerList
                      token={session?.token ?? null}
                      onSelectFreelancer={(id) => setSelectedFreelancerId(id)}
                    />
                  )}
                </>
              ) : view === 'profile' && session ? (
                /* My Profile View */
                <ProfilePage
                  token={session.token}
                  onClose={() => setView('projects')}
                />
              ) : (
                /* AI View */
                <AiRecommend token={session?.token ?? null} />
              )}

              {orderTarget && session && (
                <ServiceOrderDialog
                  service={orderTarget}
                  token={session.token}
                  onClose={() => setOrderTarget(null)}
                  onOrdered={() => setStatusMessage('주문이 접수되었습니다.')}
                />
              )}
            </main>
          </div>

          {/* Footer */}
          <footer style={{ borderTop: '1px solid var(--border)', padding: '20px 0', marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>© {new Date().getFullYear()} Outsourcing Hub</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-ghost" style={{ fontSize: 12 }}>회사정보</button>
                <button className="btn btn-ghost" style={{ fontSize: 12 }}>약관</button>
              </div>
            </div>
          </footer>

          {/* Chat Widget */}
          {session && (
            <ChatWidget
              token={session.token}
              refreshToken={session.refresh_token}
              userId={session.user.id}
              userRole={session.user.account_type}
            />
          )}

          {/* Verify Email Modal */}
          {verifyEmailToken && (
            <VerifyEmail
              token={verifyEmailToken}
              onVerified={() => {
                setVerifyEmailToken(null)
                window.history.replaceState({}, '', window.location.pathname)
                setShowLogin(true)
                setStatusMessage('이메일 인증이 완료되었습니다. 로그인해주세요.')
              }}
            />
          )}

          {/* Status Toast */}
          {statusMessage && (
            <div className="status-toast">{statusMessage}</div>
          )}
        </div>
      </BaseStyles>
    </ThemeProvider>
  )
}

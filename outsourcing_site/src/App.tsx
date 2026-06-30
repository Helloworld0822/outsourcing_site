import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Folder, FileText, Globe, Users, Inbox } from 'lucide-react'

import './index.css'
import LoginPanel from './auth/LoginPanel'
import SignUpPage from './auth/SignUpPage'
import FreelancerSetup from './profile/FreelancerSetup'
import AiRecommend from './ai/AiRecommend'
import FreelancerServiceForm from './services/FreelancerServiceForm'
import type { FreelancerService } from './services/types'
import FreelancerServiceList from './services/FreelancerServiceList'
import ServiceOrderDialog from './services/ServiceOrderDialog'
import NotificationBell from './notifications/NotificationBell'
import ChatWidget, { type ChatWidgetHandle } from './chat/ChatWidget'
import VerifyEmail from './auth/VerifyEmail'
import { API_BASE } from './api/apiBase'
import ProfilePage from './profile/ProfilePage'
import FreelancerList from './profile/FreelancerList'
import PublicProfileView from './profile/PublicProfileView'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import Sidebar from './components/layout/Sidebar'
import HeroSection from './components/sections/HeroSection'
import PromoSlide from './components/sections/PromoSlide'
import CategorySection from './components/sections/CategorySection'
import AiRecommendedProjects from './components/sections/AiRecommendedProjects'
import ProjectCard from './components/ui/ProjectCard'
import ProjectDetailModal from './components/ui/ProjectDetailModal'
import ProjectWorkspace from './components/ui/ProjectWorkspace'
import InviteFreelancerDialog from './components/ui/InviteFreelancerDialog'
import SkeletonCard from './components/ui/SkeletonCard'
import type { Project, Application, ProjectForm, ProjectRole } from './projects/types'
import { splitSkills, APPLICATION_STATUS_LABELS, roleLabel } from './projects/types'
import {
  fetchProject,
  reviewApplication,
  inviteFreelancer,
  respondToInvitation,
  applyToProjectApi,
  fetchFreelancerInvitations,
} from './projects/api'

const DUMMY_PROJECTS: Project[] = [
  {
    id: 'dummy-1',
    title: 'React 기반 쇼핑몰 리뉴얼',
    description: '기존 PHP 쇼핑몰을 React + TypeScript로 마이그레이션합니다. 반응형 UI, 결제 연동, 관리자 대시보드 포함.',
    skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
    budget: '5,000,000원',
    client_name: '김지수',
    inserted_at: '2026-06-10T09:00:00Z',
    updated_at: '2026-06-10T09:00:00Z',
  },
  {
    id: 'dummy-2',
    title: 'Spring Boot 백엔드 API 개발',
    description: '모바일 앱용 REST API 서버 설계 및 개발. JWT 인증, 파일 업로드, 푸시 알림 연동.',
    skills: ['Java', 'Spring Boot', 'MySQL', 'AWS'],
    budget: '3,500,000원',
    client_name: '이서연',
    inserted_at: '2026-06-09T14:30:00Z',
    updated_at: '2026-06-09T14:30:00Z',
  },
  {
    id: 'dummy-3',
    title: 'Flutter 크로스플랫폼 앱 개발',
    description: 'iOS/Android 동시 출시 가능한 배달 서비스 앱. 지도 연동, 실시간 주문 추적, 결제 시스템.',
    skills: ['Flutter', 'Dart', 'Firebase', 'Google Maps API'],
    budget: '8,000,000원',
    client_name: '박민호',
    inserted_at: '2026-06-08T11:00:00Z',
    updated_at: '2026-06-08T11:00:00Z',
  },
  {
    id: 'dummy-4',
    title: 'AI 챗봇 시스템 구축',
    description: '고객 문의 자동 응답 챗봇. 자연어 처리, FAQ DB 연동, 관리자 대시보드에서 대화 로그 확인 가능.',
    skills: ['Python', 'FastAPI', 'OpenAI', 'LangChain'],
    budget: '4,200,000원',
    client_name: '최수빈',
    inserted_at: '2026-06-07T16:00:00Z',
    updated_at: '2026-06-07T16:00:00Z',
  },
  {
    id: 'dummy-5',
    title: 'Vue.js 대시보드 UI/UX 리디자인',
    description: '사내 관리용 대시보드 전면 개편. 차트 라이브러리 도입, 다크모드 지원, 모바일 반응형.',
    skills: ['Vue.js', 'TypeScript', 'Tailwind CSS', 'Chart.js'],
    budget: '2,800,000원',
    client_name: '정하늘',
    inserted_at: '2026-06-06T10:00:00Z',
    updated_at: '2026-06-06T10:00:00Z',
  },
  {
    id: 'dummy-6',
    title: 'Kubernetes 클라우드 인프라 구축',
    description: 'EKS 기반 마이크로서비스 아키텍처 구축. CI/CD 파이프라인, 모니터링, 로깅 설정.',
    skills: ['Kubernetes', 'Docker', 'AWS', 'Terraform'],
    budget: '6,000,000원',
    client_name: '한도윤',
    inserted_at: '2026-06-05T13:00:00Z',
    updated_at: '2026-06-05T13:00:00Z',
  },
]
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
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname)
  const [verifyEmailToken, setVerifyEmailToken] = useState<string | null>(null)
  const [view, setView] = useState<'projects' | 'services' | 'ai' | 'profile' | 'freelancers'>('projects')
  const [servicesRefreshKey, setServicesRefreshKey] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedFreelancerId, setSelectedFreelancerId] = useState<string | null>(null)
  const [orderTarget, setOrderTarget] = useState<FreelancerService | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [workspaceProject, setWorkspaceProject] = useState<Project | null>(null)
  const [inviteTarget, setInviteTarget] = useState<{ id: string; name: string } | null>(null)
  const chatWidgetRef = useRef<ChatWidgetHandle>(null)
  const [session, setSession] = useState<Session | null>(() => {
    const token = getStoredToken()
    const refresh_token = getStoredRefreshToken()
    const user = getStoredUser()
    if (!token || !refresh_token || !user) return null
    return { token, refresh_token, user }
  })
  const [colorMode, setColorMode] = useState<'day' | 'night'>(() => {
    const stored = localStorage.getItem('colorMode')
    if (stored === 'night' || stored === 'day') return stored
    return 'day'
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token && window.location.pathname === '/verify-email') {
      setVerifyEmailToken(token)
    }
  }, [])

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const [publicProjects, setPublicProjects] = useState<Project[]>([])
  const [clientProjects, setClientProjects] = useState<Project[]>([])
  const [freelancerApplications, setFreelancerApplications] = useState<Application[]>([])
  const [freelancerInvitations, setFreelancerInvitations] = useState<Application[]>([])
  const [projectForm, setProjectForm] = useState<ProjectForm>({ title: '', description: '', skills: '', budget: '' })
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
    if (session) persistSession(session)
    else clearPersistedSession()
  }, [session])

  useEffect(() => {
    if (!statusMessage) return
    const timer = setTimeout(() => setStatusMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [statusMessage])

  const skills = useMemo(() => {
    const s = new Set<string>()
    publicProjects.forEach((p) => p.skills?.forEach((k) => s.add(k)))
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
      const body = await readJsonResponse<{ token: string; refresh_token: string }>(res)
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
        if (incoming instanceof Headers) incoming.forEach((value, key) => { headers[key] = value })
        else if (Array.isArray(incoming)) incoming.forEach(([key, value]) => { headers[key] = value })
        else Object.assign(headers, incoming as Record<string, string>)
      }
      if (init.body && !(init.body instanceof FormData) && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
      if (auth) { const token = session?.token ?? getStoredToken(); if (token) headers['Authorization'] = `Bearer ${token}` }

      const doFetch = async (overrideToken?: string | null): Promise<Response> => {
        const finalHeaders = { ...headers }
        if (auth) { const t = overrideToken ?? session?.token ?? getStoredToken(); if (t) finalHeaders['Authorization'] = `Bearer ${t}`; else delete finalHeaders['Authorization'] }
        return fetch(`${API_BASE}${path}`, { ...init, headers: finalHeaders })
      }

      let res = await doFetch()
      if (res.status === 401 && auth) {
        const refreshed = await tryRefresh()
        if (refreshed) { const newToken = getStoredToken(); setSession((prev) => (prev && newToken ? { ...prev, token: newToken } : prev)); res = await doFetch() }
      }

      const body = await readJsonResponse<T>(res)
      if (!res.ok) {
        if (res.status === 401 && auth) setSession(null)
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
    try { const body = await apiRequest<{ data: Project[] }>('/api/projects'); setPublicProjects(body.data.length > 0 ? body.data : DUMMY_PROJECTS) }
    catch { setPublicProjects(DUMMY_PROJECTS) }
    finally { setLoadingPublic(false) }
  }, [apiRequest])

  const loadClientProjects = useCallback(async () => {
    setLoadingPrivate(true)
    try { const body = await apiRequest<{ data: Project[] }>('/api/client/projects', {}, true); setClientProjects(body.data) }
    catch (error) { setStatusMessage(error instanceof Error ? error.message : '내 프로젝트를 불러오지 못했습니다.') }
    finally { setLoadingPrivate(false) }
  }, [apiRequest])

  const loadFreelancerInvitations = useCallback(async () => {
    try {
      const data = await fetchFreelancerInvitations(apiRequest)
      setFreelancerInvitations(data)
    } catch {
      setFreelancerInvitations([])
    }
  }, [apiRequest])

  const loadFreelancerApplications = useCallback(async () => {
    setLoadingPrivate(true)
    try {
      const body = await apiRequest<{ data: Application[] }>('/api/freelancer/applications', {}, true)
      setFreelancerApplications(body.data)
      await loadFreelancerInvitations()
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : '지원 내역을 불러오지 못했습니다.') }
    finally { setLoadingPrivate(false) }
  }, [apiRequest, loadFreelancerInvitations])

  useEffect(() => { loadPublicProjects() }, [loadPublicProjects])

  useEffect(() => {
    if (!session) { setClientProjects([]); setFreelancerApplications([]); setFreelancerInvitations([]); return }
    if (session.user.account_type === 'client') { loadClientProjects(); setFreelancerApplications([]); setFreelancerInvitations([]); return }
    if (session.user.account_type === 'freelancer') { loadFreelancerApplications(); setClientProjects([]) }
  }, [session, loadClientProjects, loadFreelancerApplications])

  function handleSession(sessionValue: Session) {
    setSession(sessionValue)
    setShowLogin(false)
    if (sessionValue.user.account_type === 'freelancer') {
      window.history.pushState({}, '', '/freelancer-setup'); setCurrentPath('/freelancer-setup'); setStatusMessage('로그인되었습니다. 프로필을 설정해주세요.')
    } else {
      window.history.pushState({}, '', '/'); setCurrentPath('/'); setStatusMessage('로그인되었습니다.')
    }
  }

  function handleLogout() { setSession(null); setShowLogin(false); window.history.pushState({}, '', '/'); setCurrentPath('/'); setStatusMessage('로그아웃되었습니다.') }

  async function createProject() {
    if (!session || role !== 'client') return
    try {
      const body = await apiRequest<{ data: Project }>('/api/projects', { method: 'POST', body: JSON.stringify({ title: projectForm.title, description: projectForm.description, skills: splitSkills(projectForm.skills), budget: projectForm.budget }) }, true)
      setPublicProjects((prev) => [body.data, ...prev]); setClientProjects((prev) => [body.data, ...prev]); setProjectForm({ title: '', description: '', skills: '', budget: '' }); setStatusMessage('프로젝트를 생성했습니다.')
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : '프로젝트 생성에 실패했습니다.') }
  }

  async function applyToProject(projectId: string, message?: string, proposedRole?: ProjectRole) {
    if (!session || role !== 'freelancer') return
    const applyMessage = message || applicationDrafts[projectId]?.trim()
    if (!applyMessage) { setStatusMessage('지원 메시지를 입력해주세요.'); return }
    try {
      const data = await applyToProjectApi(apiRequest, projectId, applyMessage, proposedRole ?? 'developer')
      setFreelancerApplications((prev) => [data, ...prev])
      setApplicationDrafts((prev) => ({ ...prev, [projectId]: '' }))
      setStatusMessage('프로젝트에 지원했습니다.')
      setSelectedProject(null)
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : '지원에 실패했습니다.') }
  }

  async function openClientWorkspace(project: Project) {
    try {
      const detail = await fetchProject(apiRequest, project.id)
      setWorkspaceProject(detail)
    } catch {
      setWorkspaceProject(project)
    }
  }

  async function refreshWorkspace() {
    if (!workspaceProject) return
    try {
      const detail = await fetchProject(apiRequest, workspaceProject.id)
      setWorkspaceProject(detail)
      loadClientProjects()
    } catch { /* silent */ }
  }

  async function handleReviewApplication(appId: string, action: 'accept' | 'reject', role?: string) {
    if (!workspaceProject) return
    await reviewApplication(apiRequest, workspaceProject.id, appId, action, role)
    setStatusMessage(action === 'accept' ? '지원을 수락했습니다. 팀 채팅방이 생성되었습니다.' : '지원을 거절했습니다.')
    await refreshWorkspace()
  }

  async function handleRespondInvitation(appId: string, action: 'accept' | 'reject') {
    if (!workspaceProject) return
    await respondToInvitation(apiRequest, workspaceProject.id, appId, action)
    setStatusMessage(action === 'accept' ? '초대를 수락했습니다.' : '초대를 거절했습니다.')
    await refreshWorkspace()
    loadFreelancerInvitations()
  }

  async function handleInviteFreelancer(projectId: string, message: string, role: ProjectRole) {
    if (!inviteTarget) return
    await inviteFreelancer(apiRequest, projectId, inviteTarget.id, message, role)
    setStatusMessage(`${inviteTarget.name}님에게 초대를 보냈습니다.`)
    setInviteTarget(null)
    loadClientProjects()
  }

  function handleOpenTeamChat(projectId: string) {
    chatWidgetRef.current?.openProjectGroupChat(projectId)
  }

  function handleOpenDirectChat(freelancerId: string) {
    chatWidgetRef.current?.openDirectChat(freelancerId)
  }

  const isOnSignupPage = currentPath === '/signup' && !isLoggedIn
  const isOnFreelancerSetup = currentPath === '/freelancer-setup' && isLoggedIn && session?.user.account_type === 'freelancer'

  return (
    <>
      <div data-theme={colorMode}>
        {isOnSignupPage ? (
          <SignUpPage onBack={() => { window.history.pushState({}, '', '/'); setCurrentPath('/'); }} onSignupComplete={(email) => { window.history.pushState({}, '', '/'); setCurrentPath('/'); setShowLogin(true); setStatusMessage(`${email}로 인증 메일이 발송되었습니다. 로그인해주세요.`) }} />
        ) : isOnFreelancerSetup ? (
          <FreelancerSetup token={session!.token} onComplete={() => { window.history.pushState({}, '', '/'); setCurrentPath('/'); setStatusMessage('프로필이 저장되었습니다.') }} onSkip={() => { window.history.pushState({}, '', '/'); setCurrentPath('/'); }} />
        ) : (
        <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
          <Header
            session={session}
            view={view}
            onViewChange={(v) => setView(v as typeof view)}
            onLoginClick={() => setShowLogin(true)}
            onSignupClick={() => { window.history.pushState({}, '', '/signup'); setCurrentPath('/signup'); }}
            onLogout={handleLogout}
            onProfileClick={() => setView('profile')}
            colorMode={colorMode}
            onColorModeToggle={() => setColorMode((prev) => prev === 'day' ? 'night' : 'day')}
            notificationBell={session ? <NotificationBell token={session.token} refreshToken={session.refresh_token} /> : undefined}
          />

          {showLogin && !isLoggedIn && (
            <div className="max-w-md mx-auto mt-4 px-4">
              <LoginPanel onLogin={handleSession} onClose={() => setShowLogin(false)} />
            </div>
          )}

          <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
            {view === 'projects' && (
              <>
                <div className="flex gap-4 mb-6 items-stretch">
                  <div className="flex-1">
                    <HeroSection
                      onSearch={(q) => setQuery(q)}
                      onTagClick={(tag) => setSkillFilter(tag)}
                      onQueryChange={(q) => setQuery(q)}
                    />
                  </div>
                  <div className="hidden lg:block w-96 shrink-0">
                    <PromoSlide />
                  </div>
                </div>
                <CategorySection onCategoryClick={(categoryId) => { setView('services'); setSelectedCategory(categoryId); }} />

                <AiRecommendedProjects
                  projects={filteredProjects.slice(0, 3)}
                  matchRates={Object.fromEntries(filteredProjects.slice(0, 3).map((p, i) => [p.id, 95 - i * 8]))}
                  onApply={applyToProject}
                  role={role}
                />

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-8">
                  <div className="lg:col-span-1">
                    <Sidebar skills={skills} skillFilter={skillFilter} onSkillFilterChange={setSkillFilter} />
                  </div>

                  <div className="lg:col-span-3">
                    {role === 'client' && (
                      <div className="mb-6 p-5 rounded-2xl" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)' }}>
                        <h3 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}><Folder className="w-5 h-5" /> 새 프로젝트 등록</h3>
                        <div className="space-y-3">
                          <input className="w-full px-4 py-3 rounded-full text-sm outline-none transition-colors" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} placeholder="프로젝트 제목" value={projectForm.title} onChange={(e: ChangeEvent<HTMLInputElement>) => setProjectForm((p) => ({ ...p, title: e.target.value }))} />
                          <textarea className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-colors resize-none" rows={3} style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} placeholder="프로젝트 설명" value={projectForm.description} onChange={(e) => setProjectForm((p) => ({ ...p, description: e.target.value }))} />
                          <div className="grid grid-cols-2 gap-3">
                            <input className="px-4 py-3 rounded-full text-sm outline-none transition-colors" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} placeholder="기술 스택 (React, TypeScript)" value={projectForm.skills} onChange={(e: ChangeEvent<HTMLInputElement>) => setProjectForm((p) => ({ ...p, skills: e.target.value }))} />
                            <input className="px-4 py-3 rounded-full text-sm outline-none transition-colors" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} placeholder="예산 (1,000,000원)" value={projectForm.budget} onChange={(e: ChangeEvent<HTMLInputElement>) => setProjectForm((p) => ({ ...p, budget: e.target.value }))} />
                          </div>
                          <button onClick={createProject} disabled={loadingPrivate} className="px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200" style={{ background: 'var(--color-primary)' }} onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')} onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')} onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}>프로젝트 생성</button>
                        </div>
                      </div>
                    )}

                    {role === 'client' && clientProjects.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}><Folder className="w-5 h-5" /> 내 프로젝트</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {clientProjects.map((p) => (
                            <ProjectCard
                              key={p.id}
                              project={p}
                              role={role}
                              onClick={() => openClientWorkspace(p)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {role === 'freelancer' && freelancerInvitations.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>받은 초대</h3>
                        <div className="space-y-3">
                          {freelancerInvitations.filter((i) => i.status === 'pending').map((inv) => (
                            <div key={inv.id} className="p-4 rounded-2xl" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)' }}>
                              <div className="flex justify-between items-start">
                                <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{inv.project?.title ?? '프로젝트'}</span>
                                <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                                  {roleLabel(inv.proposed_role)}
                                </span>
                              </div>
                              <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>{inv.message}</p>
                              <div className="flex gap-2 mt-3">
                                <button
                                  onClick={async () => {
                                    try {
                                      await respondToInvitation(apiRequest, inv.project_id, inv.id, 'accept')
                                      setStatusMessage('초대를 수락했습니다. 팀 채팅방에 참여하세요.')
                                      loadFreelancerInvitations()
                                      loadFreelancerApplications()
                                      chatWidgetRef.current?.openProjectGroupChat(inv.project_id)
                                    } catch (e) { setStatusMessage(e instanceof Error ? e.message : '처리 실패') }
                                  }}
                                  className="flex-1 px-4 py-2 rounded-full text-sm font-semibold text-white"
                                  style={{ background: 'var(--color-primary)' }}
                                >
                                  수락
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await respondToInvitation(apiRequest, inv.project_id, inv.id, 'reject')
                                      setStatusMessage('초대를 거절했습니다.')
                                      loadFreelancerInvitations()
                                    } catch (e) { setStatusMessage(e instanceof Error ? e.message : '처리 실패') }
                                  }}
                                  className="flex-1 px-4 py-2 rounded-full text-sm font-semibold"
                                  style={{ color: 'var(--color-error)', border: '1px solid var(--color-error)' }}
                                >
                                  거절
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {role === 'freelancer' && freelancerApplications.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}><FileText className="w-5 h-5" /> 내 수주 현황</h3>
                        <div className="space-y-3">
                          {freelancerApplications.map((app) => (
                            <div key={app.id} className="p-4 rounded-2xl" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)' }}>
                              <div className="flex justify-between items-start">
                                <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{app.project?.title ?? '프로젝트'}</span>
                                <span className="px-3 py-1 rounded-full text-xs font-medium" style={{
                                  background: app.status === 'accepted' ? 'var(--color-success-light)' : app.status === 'rejected' ? 'var(--color-error-light)' : 'var(--color-warning-light)',
                                  color: app.status === 'accepted' ? 'var(--color-success)' : app.status === 'rejected' ? 'var(--color-error)' : 'var(--color-warning)',
                                }}>{APPLICATION_STATUS_LABELS[app.status] ?? app.status}</span>
                              </div>
                              <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>{app.message}</p>
                              {app.status === 'accepted' && (
                                <button
                                  onClick={() => chatWidgetRef.current?.openProjectGroupChat(app.project_id)}
                                  className="mt-3 px-4 py-2 rounded-full text-xs font-semibold text-white"
                                  style={{ background: 'var(--color-primary)' }}
                                >
                                  팀 채팅 열기
                                </button>
                              )}
                              {app.inserted_at && <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>{new Date(app.inserted_at).toLocaleDateString('ko-KR')}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}><Globe className="w-5 h-5" /> 전체 프로젝트</h3>
                      {loadingPublic ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
                        </div>
                      ) : filteredProjects.length === 0 ? (
                        <div className="text-center py-16 rounded-2xl" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)' }}>
                          <div className="mb-4 flex justify-center" style={{ color: 'var(--color-text-muted)' }}><Inbox className="w-12 h-12" /></div>
                          <p style={{ color: 'var(--color-text-secondary)' }}>검색 결과가 없습니다.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {filteredProjects.map((project) => (
                            <ProjectCard
                              key={project.id}
                              project={project}
                              role={role}
                              onApply={applyToProject}
                              onClick={() => setSelectedProject(project)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {view === 'services' && (
              <div className="max-w-4xl mx-auto">
                {role === 'freelancer' && session && (
                  <FreelancerServiceForm token={session.token} onCreated={() => { setServicesRefreshKey((k) => k + 1); setStatusMessage('서비스가 등록되었습니다.') }} />
                )}
                <FreelancerServiceList token={session?.token ?? null} refreshKey={servicesRefreshKey} initialCategory={selectedCategory} onOrder={(svc) => {
                  if (!session) { setShowLogin(true); setStatusMessage('주문하려면 로그인이 필요합니다.'); return }
                  if (role !== 'client') { setStatusMessage('서비스 주문은 클라이언트 계정만 가능합니다.'); return }
                  setOrderTarget(svc)
                }} />
              </div>
            )}

            {view === 'freelancers' && (
              <div>
                <div className="mb-6 p-8 rounded-2xl text-center" style={{ background: 'var(--color-house-green)', border: '1px solid var(--color-border-light)' }}>
                  <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2 justify-center"><Users className="w-6 h-6" /> 프리랜서 찾기</h2>
                  <p style={{ color: 'var(--color-text-white-soft)' }}>원하는 기술을 보유한 프리랜서를 찾아 바로 연락해보세요.</p>
                </div>
                {selectedFreelancerId ? (
                  <PublicProfileView
                    userId={selectedFreelancerId}
                    token={session?.token ?? null}
                    onBack={() => setSelectedFreelancerId(null)}
                    onContactFreelancer={(id) => {
                      if (!session) { setShowLogin(true); return }
                      chatWidgetRef.current?.openDirectChat(id)
                    }}
                    onInviteFreelancer={role === 'client' && session ? (id, name) => setInviteTarget({ id, name }) : undefined}
                  />
                ) : (
                  <FreelancerList token={session?.token ?? null} onSelectFreelancer={(id) => setSelectedFreelancerId(id)} />
                )}
              </div>
            )}

            {view === 'profile' && session && (
              <ProfilePage token={session.token} onClose={() => setView('projects')} />
            )}

            {view === 'ai' && (
              <AiRecommend token={session?.token ?? null} />
            )}

            {orderTarget && session && (
              <ServiceOrderDialog service={orderTarget} token={session.token} onClose={() => setOrderTarget(null)} onOrdered={() => setStatusMessage('주문이 접수되었습니다.')} />
            )}

            {selectedProject && (
              <ProjectDetailModal
                project={selectedProject}
                role={role}
                isOwner={role === 'client' && selectedProject.client_id === session?.user.id}
                onClose={() => setSelectedProject(null)}
                onApply={(id, msg, roleVal) => applyToProject(id, msg, roleVal)}
                onOpenWorkspace={() => openClientWorkspace(selectedProject)}
              />
            )}

            {workspaceProject && session && (
              <ProjectWorkspace
                project={workspaceProject}
                isOwner={role === 'client' && workspaceProject.client_id === session.user.id}
                onClose={() => setWorkspaceProject(null)}
                onRefresh={refreshWorkspace}
                onReviewApplication={handleReviewApplication}
                onRespondInvitation={role === 'freelancer' ? handleRespondInvitation : undefined}
                onOpenTeamChat={handleOpenTeamChat}
                onOpenDirectChat={handleOpenDirectChat}
              />
            )}

            {inviteTarget && role === 'client' && (
              <InviteFreelancerDialog
                projects={clientProjects}
                freelancerName={inviteTarget.name}
                onClose={() => setInviteTarget(null)}
                onInvite={handleInviteFreelancer}
              />
            )}
          </main>

          <Footer />

          {session && (
            <ChatWidget ref={chatWidgetRef} token={session.token} refreshToken={session.refresh_token} userId={session.user.id} userRole={session.user.account_type} />
          )}

          {verifyEmailToken && (
            <VerifyEmail token={verifyEmailToken} onVerified={() => { setVerifyEmailToken(null); window.history.replaceState({}, '', window.location.pathname); setShowLogin(true); setStatusMessage('이메일 인증이 완료되었습니다. 로그인해주세요.') }} />
          )}

          {statusMessage && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-sm font-medium text-white z-[9999] shadow-lg animate-fade-in" style={{ background: 'var(--color-primary)' }}>{statusMessage}</div>
          )}
        </div>
        )}
      </div>
    </>
  )
}

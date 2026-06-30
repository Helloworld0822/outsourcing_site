import { useState } from 'react'
import { MessageCircle, Users, UserPlus, X } from 'lucide-react'
import SkillBadge from './SkillBadge'
import type { Project, Application, ProjectRole } from '../../projects/types'
import { PROJECT_ROLES, roleLabel, STATUS_LABELS, APPLICATION_STATUS_LABELS } from '../../projects/types'
import { formatPrice } from '../../api/http'

interface Props {
  project: Project
  isOwner: boolean
  onClose: () => void
  onRefresh: () => void
  onReviewApplication: (appId: string, action: 'accept' | 'reject', role?: string) => Promise<void>
  onRespondInvitation?: (appId: string, action: 'accept' | 'reject') => Promise<void>
  onOpenTeamChat: (projectId: string) => void
  onOpenDirectChat: (freelancerId: string) => void
}

export default function ProjectWorkspace({
  project,
  isOwner,
  onClose,
  onReviewApplication,
  onRespondInvitation,
  onOpenTeamChat,
  onOpenDirectChat,
}: Props) {
  const [roleEdits, setRoleEdits] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const pendingApplications = (project.applications ?? []).filter(
    (a) => a.source === 'apply' && a.status === 'pending',
  )
  const pendingInvites = (project.applications ?? []).filter(
    (a) => a.source === 'invite' && a.status === 'pending',
  )
  const members = project.members ?? []
  const hasTeamChat = Boolean(project.group_chat_room_id) || members.length > 0

  async function handleReview(app: Application, action: 'accept' | 'reject') {
    setBusy(app.id)
    try {
      const role = roleEdits[app.id] || app.proposed_role || 'other'
      await onReviewApplication(app.id, action, action === 'accept' ? role : undefined)
    } finally {
      setBusy(null)
    }
  }

  async function handleRespond(app: Application, action: 'accept' | 'reject') {
    if (!onRespondInvitation) return
    setBusy(app.id)
    try {
      await onRespondInvitation(app.id, action)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-8"
        style={{ background: 'var(--color-bg-card)', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-starbucks-green)' }}>{project.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                {STATUS_LABELS[project.status ?? 'recruiting'] ?? project.status}
              </span>
              {project.budget && (
                <span className="text-sm font-semibold" style={{ color: 'var(--color-starbucks-green)' }}>{formatPrice(project.budget)}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {project.description && (
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-text-secondary)' }}>{project.description}</p>
        )}

        {project.skills?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {project.skills.map((s) => <SkillBadge key={s} skill={s} />)}
          </div>
        )}

        {/* 팀 멤버 */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <Users className="w-4 h-4" /> 팀 멤버 ({members.length})
            </h3>
            {hasTeamChat && (
              <button
                onClick={() => onOpenTeamChat(project.id)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold text-white flex items-center gap-1"
                style={{ background: 'var(--color-primary)' }}
              >
                <MessageCircle className="w-3 h-3" /> 팀 채팅
              </button>
            )}
          </div>
          {members.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>아직 팀원이 없습니다. 지원을 수락하면 팀이 구성됩니다.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--color-bg-elevated)' }}>
                  <div>
                    <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{m.user?.name ?? '이름 없음'}</span>
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                      {roleLabel(m.role)}
                    </span>
                  </div>
                  {isOwner && m.user && (
                    <button
                      onClick={() => onOpenDirectChat(m.user_id)}
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{ color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}
                    >
                      1:1 연락
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 클라이언트: 받은 지원 */}
        {isOwner && pendingApplications.length > 0 && (
          <section className="mb-6">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <UserPlus className="w-4 h-4" /> 받은 지원 ({pendingApplications.length})
            </h3>
            <div className="space-y-3">
              {pendingApplications.map((app) => (
                <ApplicationCard
                  key={app.id}
                  app={app}
                  busy={busy === app.id}
                  roleValue={(roleEdits[app.id] ?? app.proposed_role ?? 'developer') as ProjectRole}
                  onRoleChange={(role) => setRoleEdits((prev) => ({ ...prev, [app.id]: role }))}
                  onAccept={() => handleReview(app, 'accept')}
                  onReject={() => handleReview(app, 'reject')}
                  showRoleEdit
                />
              ))}
            </div>
          </section>
        )}

        {/* 보낸 초대 (클라이언트) */}
        {isOwner && pendingInvites.length > 0 && (
          <section className="mb-6">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>보낸 초대 ({pendingInvites.length})</h3>
            <div className="space-y-2">
              {pendingInvites.map((app) => (
                <div key={app.id} className="p-3 rounded-xl" style={{ background: 'var(--color-bg-elevated)' }}>
                  <div className="font-medium text-sm">{app.freelancer.name}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{roleLabel(app.proposed_role)} · 대기 중</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 프리랜서: 받은 초대 respond */}
        {!isOwner && pendingInvites.filter((a) => a.freelancer_id).length > 0 && onRespondInvitation && (
          <section className="mb-6">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>받은 초대</h3>
            {pendingInvites.map((app) => (
              <ApplicationCard
                key={app.id}
                app={app}
                busy={busy === app.id}
                roleValue={app.proposed_role as ProjectRole}
                onAccept={() => handleRespond(app, 'accept')}
                onReject={() => handleRespond(app, 'reject')}
              />
            ))}
          </section>
        )}

        {/* 처리된 지원 목록 */}
        {(project.applications ?? []).filter((a) => a.status !== 'pending').length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-muted)' }}>처리 내역</h3>
            <div className="space-y-2">
              {(project.applications ?? [])
                .filter((a) => a.status !== 'pending')
                .map((app) => (
                  <div key={app.id} className="p-3 rounded-xl text-sm" style={{ background: 'var(--color-bg-elevated)' }}>
                    <span className="font-medium">{app.freelancer.name}</span>
                    <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {APPLICATION_STATUS_LABELS[app.status]} · {roleLabel(app.proposed_role)}
                    </span>
                  </div>
                ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function ApplicationCard({
  app,
  busy,
  roleValue,
  onRoleChange,
  onAccept,
  onReject,
  showRoleEdit,
}: {
  app: Application
  busy: boolean
  roleValue?: ProjectRole
  onRoleChange?: (role: ProjectRole) => void
  onAccept: () => void
  onReject: () => void
  showRoleEdit?: boolean
}) {
  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-light)' }}>
      <div className="font-semibold text-sm mb-1" style={{ color: 'var(--color-text)' }}>{app.freelancer.name}</div>
      <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>{app.message}</p>
      {app.proposed_role && (
        <div className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
          제안 역할: {roleLabel(app.proposed_role)}
        </div>
      )}
      {showRoleEdit && onRoleChange && (
        <select
          value={roleValue ?? 'developer'}
          onChange={(e) => onRoleChange(e.target.value as ProjectRole)}
          className="mb-3 px-3 py-2 rounded-lg text-sm w-full outline-none"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        >
          {PROJECT_ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <button
          disabled={busy}
          onClick={onAccept}
          className="flex-1 px-4 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--color-primary)' }}
        >
          수락
        </button>
        <button
          disabled={busy}
          onClick={onReject}
          className="flex-1 px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
          style={{ color: 'var(--color-error)', border: '1px solid var(--color-error)' }}
        >
          거절
        </button>
      </div>
    </div>
  )
}

import { Avatar } from '@primer/react'
import { formatPrice } from '../api/http'
import type { Project } from './types'
import type { AccountType } from '../api/types'

type ProjectCardProps = {
  project: Project
  role: AccountType | null
  draft: string
  onDraftChange: (projectId: string, value: string) => void
  onApply: (projectId: string) => void
  showApplications: boolean
}

export default function ProjectCard({ project, role, draft, onDraftChange, onApply, showApplications }: ProjectCardProps) {
  const clientName = project.client_name || '익명 클라이언트'

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, lineHeight: 1.4 }}>{project.title}</h3>
            <p style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, margin: '6px 0 0' }}>
              {project.description || '설명이 없습니다.'}
            </p>
            {project.skills.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {project.skills.map((s) => (
                  <span key={s} className="chip">{s}</span>
                ))}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent)' }}>
              {formatPrice(project.budget)}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
          <Avatar alt={clientName} src="/favicon.svg" size={24} />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{clientName}</span>
        </div>

        {role === 'freelancer' && !showApplications && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
            <label className="form-label">지원 메시지</label>
            <textarea
              className="form-textarea"
              value={draft}
              onChange={(e) => onDraftChange(project.id, e.target.value)}
              rows={3}
              placeholder="프로젝트에 지원할 내용을 적어주세요."
              style={{ marginTop: 4 }}
            />
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-primary" onClick={() => onApply(project.id)}>지원하기</button>
            </div>
          </div>
        )}

        {showApplications && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
            <div className="section-title">받은 지원</div>
            {(project.applications?.length || 0) === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>아직 지원이 없습니다.</p>
            ) : (
              project.applications?.map((application) => (
                <div key={application.id} style={{ padding: 10, borderRadius: 'var(--radius)', background: 'var(--surface-alt)', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{application.freelancer.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{application.freelancer.email}</div>
                  <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>{application.message}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

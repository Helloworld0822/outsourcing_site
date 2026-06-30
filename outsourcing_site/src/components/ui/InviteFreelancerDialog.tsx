import { useState } from 'react'
import { X } from 'lucide-react'
import type { Project, ProjectRole } from '../../projects/types'
import { PROJECT_ROLES } from '../../projects/types'

interface Props {
  projects: Project[]
  freelancerName: string
  onClose: () => void
  onInvite: (projectId: string, message: string, role: ProjectRole) => Promise<void>
}

export default function InviteFreelancerDialog({ projects, freelancerName, onClose, onInvite }: Props) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [message, setMessage] = useState('')
  const [role, setRole] = useState<ProjectRole>('developer')
  const [submitting, setSubmitting] = useState(false)

  const recruiting = projects.filter((p) => (p.status ?? 'recruiting') === 'recruiting')

  async function handleSubmit() {
    if (!projectId || !message.trim()) return
    setSubmitting(true)
    try {
      await onInvite(projectId, message.trim(), role)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  if (recruiting.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div className="w-full max-w-md rounded-3xl p-6" style={{ background: 'var(--color-bg-card)' }}>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>모집 중인 프로젝트가 없습니다. 먼저 프로젝트를 등록해주세요.</p>
          <button onClick={onClose} className="w-full px-4 py-2 rounded-full text-sm font-semibold text-white" style={{ background: 'var(--color-primary)' }}>닫기</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md rounded-3xl p-6" style={{ background: 'var(--color-bg-card)' }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold" style={{ color: 'var(--color-starbucks-green)' }}>{freelancerName}님 초대</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--color-bg-elevated)' }}><X className="w-4 h-4" /></button>
        </div>

        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>프로젝트</label>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full mb-3 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        >
          {recruiting.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>

        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>역할</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as ProjectRole)}
          className="w-full mb-3 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        >
          {PROJECT_ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>초대 메시지</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="프로젝트에 함께해주시면 좋겠습니다..."
          className="w-full mb-4 px-3 py-2 rounded-xl text-sm outline-none resize-none"
          style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />

        <button
          disabled={!message.trim() || submitting}
          onClick={handleSubmit}
          className="w-full px-4 py-3 rounded-full text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: 'var(--color-primary)' }}
        >
          {submitting ? '초대 중...' : '초대 보내기'}
        </button>
      </div>
    </div>
  )
}

import type { SessionUser } from '../api/types'

export type ProjectRole = 'designer' | 'developer' | 'pm' | 'other'

export const PROJECT_ROLES: { value: ProjectRole; label: string }[] = [
  { value: 'designer', label: '디자이너' },
  { value: 'developer', label: '개발자' },
  { value: 'pm', label: 'PM' },
  { value: 'other', label: '기타' },
]

export function roleLabel(role: string | null | undefined) {
  return PROJECT_ROLES.find((r) => r.value === role)?.label ?? role ?? '멤버'
}

export type Application = {
  id: string
  project_id: string
  freelancer_id: string
  message: string
  proposed_role: string | null
  source: string
  status: string
  freelancer: SessionUser
  project?: { id: string; title: string; status?: string }
  inserted_at: string | null
  updated_at: string | null
}

export type ProjectMember = {
  id: string
  project_id: string
  user_id: string
  role: string
  user: SessionUser | null
  joined_at: string | null
}

export type ProjectStatus = 'recruiting' | 'in_progress' | 'completed' | 'closed'

export type Project = {
  id: string
  title: string
  description: string
  skills: string[]
  budget: string
  client_name: string | null
  client_id?: string | null
  status?: ProjectStatus | string
  group_chat_room_id?: string | null
  inserted_at: string | null
  updated_at: string | null
  applications?: Application[]
  members?: ProjectMember[]
}

export type ProjectForm = {
  title: string
  description: string
  skills: string
  budget: string
}

export function splitSkills(value: string) {
  return value
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean)
}

export const STATUS_LABELS: Record<string, string> = {
  recruiting: '모집 중',
  in_progress: '진행 중',
  completed: '완료',
  closed: '종료',
}

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  pending: '검토 중',
  accepted: '수락됨',
  rejected: '거절됨',
}

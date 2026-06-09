import type { SessionUser } from '../api/types'

export type Application = {
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

export type Project = {
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

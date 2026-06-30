import type { Application, Project, ProjectMember, ProjectRole } from './types'

type ApiFn = <T>(path: string, init?: RequestInit, auth?: boolean) => Promise<T>

export async function fetchProject(apiRequest: ApiFn, projectId: string) {
  const body = await apiRequest<{ data: Project }>(`/api/projects/${projectId}`, {}, true)
  return body.data
}

export async function reviewApplication(
  apiRequest: ApiFn,
  projectId: string,
  appId: string,
  action: 'accept' | 'reject',
  role?: string,
) {
  const body = await apiRequest<{ data: Application }>(
    `/api/projects/${projectId}/applications/${appId}`,
    { method: 'PATCH', body: JSON.stringify({ action, role }) },
    true,
  )
  return body.data
}

export async function inviteFreelancer(
  apiRequest: ApiFn,
  projectId: string,
  freelancerId: string,
  message: string,
  proposedRole?: ProjectRole,
) {
  const body = await apiRequest<{ data: Application }>(
    `/api/projects/${projectId}/invitations`,
    {
      method: 'POST',
      body: JSON.stringify({ freelancer_id: freelancerId, message, proposed_role: proposedRole }),
    },
    true,
  )
  return body.data
}

export async function respondToInvitation(
  apiRequest: ApiFn,
  projectId: string,
  appId: string,
  action: 'accept' | 'reject',
) {
  const body = await apiRequest<{ data: Application }>(
    `/api/projects/${projectId}/invitations/${appId}/respond`,
    { method: 'PATCH', body: JSON.stringify({ action }) },
    true,
  )
  return body.data
}

export async function fetchProjectMembers(apiRequest: ApiFn, projectId: string) {
  const body = await apiRequest<{ data: ProjectMember[] }>(`/api/projects/${projectId}/members`, {}, true)
  return body.data
}

export async function createDirectChatRoom(apiRequest: ApiFn, freelancerId: string) {
  const body = await apiRequest<{ data: { id: string } }>(
    '/api/chat/rooms',
    { method: 'POST', body: JSON.stringify({ freelancer_id: freelancerId }) },
    true,
  )
  return body.data
}

export async function openProjectGroupChat(apiRequest: ApiFn, projectId: string) {
  const body = await apiRequest<{ data: { id: string } }>(
    '/api/chat/rooms',
    { method: 'POST', body: JSON.stringify({ project_id: projectId }) },
    true,
  )
  return body.data
}

export async function applyToProjectApi(
  apiRequest: ApiFn,
  projectId: string,
  message: string,
  proposedRole?: ProjectRole,
) {
  const body = await apiRequest<{ data: Application }>(
    `/api/projects/${projectId}/applications`,
    { method: 'POST', body: JSON.stringify({ message, proposed_role: proposedRole }) },
    true,
  )
  return body.data
}

export async function fetchFreelancerInvitations(apiRequest: ApiFn) {
  const body = await apiRequest<{ data: Application[] }>('/api/freelancer/invitations', {}, true)
  return body.data
}

import { ApiError, apiRequest } from '../../../lib/apiClient'

export type TeamMemberRow = {
  userId: string
  username: string
  displayName: string
  role: string
  teamId: string | null
}

export type TeamMembersResponse = {
  teamId: string | null
  teamName: string | null
  members: TeamMemberRow[]
}

export async function fetchTeamMembers(token: string): Promise<TeamMembersResponse> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<TeamMembersResponse>('/api/teams/members', { token })
}

export async function createTeam(token: string, name?: string): Promise<{ teamId: string; name: string; gaId: number }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<{ teamId: string; name: string; gaId: number }>('/api/teams/create', {
    method: 'POST',
    token,
    body: JSON.stringify(name?.trim() ? { name: name.trim() } : {}),
  })
}

export async function joinTeam(token: string, teamId: string): Promise<{ ok: boolean; teamId: string; name: string; gaId: number }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const id = String(teamId ?? '').trim()
  if (!id) {
    throw new ApiError('팀 ID를 입력해 주세요.', 400)
  }
  return apiRequest<{ ok: boolean; teamId: string; name: string; gaId: number }>('/api/teams/join', {
    method: 'POST',
    token,
    body: JSON.stringify({ teamId: id }),
  })
}

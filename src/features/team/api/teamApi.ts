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
  /** teams.owner_user_id — 팀장 사용자 id */
  ownerId: string | null
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
    throw new ApiError('팀 코드를 입력해 주세요.', 400)
  }
  return apiRequest<{ ok: boolean; teamId: string; name: string; gaId: number }>('/api/teams/join', {
    method: 'POST',
    token,
    body: JSON.stringify({ teamId: id }),
  })
}

export async function kickTeamMember(token: string, userId: string): Promise<{ ok: boolean }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const id = String(userId ?? '').trim()
  if (!id) {
    throw new ApiError('대상을 지정해 주세요.', 400)
  }
  return apiRequest<{ ok: boolean }>('/api/teams/kick', {
    method: 'POST',
    token,
    body: JSON.stringify({ userId: id }),
  })
}

export async function leaveTeam(token: string): Promise<{ ok: boolean }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<{ ok: boolean }>('/api/teams/leave', {
    method: 'POST',
    token,
    body: JSON.stringify({}),
  })
}

export type TeamPostAttachment = {
  id: string
  fileUrl: string
  fileName: string
}

export type TeamPostRow = {
  id: string
  title: string
  content: string
  isNotice: boolean
  createdAt: string
  authorId: string
  authorUsername: string
  authorDisplayName: string
  attachments: TeamPostAttachment[]
}

export type TeamPostsListResponse = {
  teamId: string
  ownerId: string | null
  posts: TeamPostRow[]
}

export async function fetchTeamPosts(token: string): Promise<TeamPostsListResponse> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<TeamPostsListResponse>('/api/teams/posts', { token })
}

export async function presignTeamPostAttachment(
  token: string,
  payload: { fileName: string; contentType: string; sizeBytes: number },
): Promise<{ uploadUrl: string; objectKey: string; putHeaders: Record<string, string> }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest('/api/teams/posts/attachments/presign', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export async function createTeamPost(
  token: string,
  body: {
    title: string
    content: string
    isNotice: boolean
    attachments: { objectKey: string; fileName: string; fileUrl: string }[]
  },
): Promise<{ postId: string; teamId: string }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest('/api/teams/posts', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export type TeamFileRow = {
  id: string
  fileUrl: string
  fileName: string
  postId: string
  postTitle: string
  postCreatedAt: string
}

export async function fetchTeamFiles(token: string): Promise<{ teamId: string; files: TeamFileRow[] }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<{ teamId: string; files: TeamFileRow[] }>('/api/teams/files', { token })
}

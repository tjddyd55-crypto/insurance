import { apiRequest } from '../../../lib/apiClient'

const WRITER_TOKEN_KEY = 'insurance_public_board_writer_token'

export type PublicBoardWriterAccount = {
  id: string
  loginId: string
  name: string
  isActive: boolean
  allowedBoardIds: string[] | null
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export type PublicBoardWriterBoard = {
  id: string
  slug: string
  label: string
}

export function getPublicBoardWriterToken(): string | null {
  try {
    return sessionStorage.getItem(WRITER_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setPublicBoardWriterToken(token: string | null) {
  try {
    if (!token) {
      sessionStorage.removeItem(WRITER_TOKEN_KEY)
      return
    }
    sessionStorage.setItem(WRITER_TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

export async function loginPublicBoardWriter(loginId: string, password: string) {
  return apiRequest<{ token: string; writer: PublicBoardWriterAccount }>('/api/public-board-writer/login', {
    method: 'POST',
    body: JSON.stringify({ loginId, password }),
  })
}

export async function fetchPublicBoardWriterMe(token: string) {
  return apiRequest<PublicBoardWriterAccount>('/api/public-board-writer/me', { token })
}

export async function listPublicBoardWriterBoards(token: string) {
  return apiRequest<PublicBoardWriterBoard[]>('/api/public-board-writer/boards', { token })
}

export async function createPublicBoardWriterPost(
  token: string,
  boardSlug: string,
  bodyText: string,
) {
  return apiRequest<{ id: string; status: string; bodyText: string }>(
    `/api/public-board-writer/boards/${encodeURIComponent(boardSlug)}/newsletters`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({ bodyText, status: 'PUBLISHED' }),
    },
  )
}

export async function listAdminPublicBoardWriters(token: string) {
  return apiRequest<PublicBoardWriterAccount[]>('/api/admin/public-board-writers', { token })
}

export async function createAdminPublicBoardWriter(
  token: string,
  input: { loginId: string; password: string; name: string; allowedBoardIds?: string[] },
) {
  return apiRequest<PublicBoardWriterAccount>('/api/admin/public-board-writers', {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  })
}

export async function createGaScopedBoardPost(token: string, boardSlug: string, bodyText: string) {
  return apiRequest<{ id: string; status: string; bodyText: string }>(
    `/api/insurer-news/boards/${encodeURIComponent(boardSlug)}/newsletters`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({ bodyText, status: 'PUBLISHED' }),
    },
  )
}

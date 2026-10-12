import { ApiError } from '../../../lib/apiClient'

/** 팀 게시판·댓글 API 사용자 안내 (서버 `DB_ERROR` 등 내부 코드 노출 방지) */
export function teamContentUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.message === 'DB_ERROR' || error.code === 'DB_ERROR') {
      return fallback
    }
    if (error.message.trim()) {
      return error.message
    }
  }
  if (error instanceof Error && error.message.trim()) {
    if (error.message === 'DB_ERROR') {
      return fallback
    }
    return error.message
  }
  return fallback
}

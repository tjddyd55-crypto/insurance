import { ApiError } from '../../../lib/apiClient'

export function mapCoverageShareCreateError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return '로그인이 만료되었습니다. 다시 로그인한 후 공유해 주세요.'
    }
    if (error.status === 403) {
      return '공유 권한이 없습니다. 계정 권한을 확인해 주세요.'
    }
    if (error.status === 400) {
      return '저장된 상담 내용을 확인한 후 다시 시도해 주세요.'
    }
    if (error.status === 503) {
      return 'Preview 공유 서버 설정이 필요합니다. DEV 환경 변수를 확인해 주세요.'
    }
  }
  return '공유 링크를 생성하지 못했습니다. 다시 시도해 주세요.'
}

export function mapCoverageShareHistoryError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
    }
    if (error.status === 403) {
      return '공유 이력을 조회할 권한이 없습니다.'
    }
  }
  return '공유 이력을 불러오지 못했습니다.'
}

import { resolveAbsoluteApiUrl, resolveApiUrl } from '../../../lib/apiClient'
import type { ClaimRequestFileItem } from '../api/claimRequestsApi'

function extractAccessTokenFromClaimFileUrl(url: string): string {
  try {
    const parsed = new URL(resolveAbsoluteApiUrl(String(url ?? '').trim()))
    return String(parsed.searchParams.get('accessToken') ?? '').trim()
  } catch {
    return ''
  }
}

/** 모바일 청구 상세: fetch blob 대신 브라우저 네비게이션으로 파일을 연다. */
export function shouldUseNativeAgentClaimFileLinks(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  try {
    if (window.matchMedia('(pointer: coarse)').matches) {
      return true
    }
    if (window.matchMedia('(max-width: 768px)').matches) {
      return true
    }
  } catch {
    return false
  }
  return false
}

export function resolveAgentClaimFileOpenHref(file: ClaimRequestFileItem): string {
  const url = String(file.url ?? '').trim()
  return url ? resolveAbsoluteApiUrl(url) : ''
}

/** signed accessToken 으로 download-auth 를 직접 열어 attachment 스트림을 받는다. */
export function resolveAgentClaimFileDownloadAuthHref(file: ClaimRequestFileItem): string {
  const downloadUrl = String(file.downloadUrl ?? '').trim()
  if (!downloadUrl) {
    return ''
  }
  const accessToken = extractAccessTokenFromClaimFileUrl(downloadUrl)
  if (!accessToken) {
    return resolveAbsoluteApiUrl(downloadUrl)
  }
  const qs = new URLSearchParams({ download: '1', accessToken })
  return resolveAbsoluteApiUrl(
    resolveApiUrl(`/api/agent/customer-claim-files/${file.id}/download-auth?${qs.toString()}`),
  )
}

export const AGENT_CLAIM_FILE_DOWNLOAD_LINK_TARGET = '_self' as const
export const AGENT_CLAIM_FILE_OPEN_LINK_TARGET = '_self' as const

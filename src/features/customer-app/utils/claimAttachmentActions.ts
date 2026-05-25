import { resolveAbsoluteApiUrl } from '../../../lib/apiClient'
import { isCustomerAppNativeWebView } from './customerAppEnvironment'

export type CustomerAppClaimAttachmentFile = {
  openUrl?: string | null
  downloadUrl?: string | null
  url?: string | null
  fileName?: string | null
}

export function resolveClaimAttachmentOpenUrl(file: CustomerAppClaimAttachmentFile): string {
  return String(file.openUrl ?? file.url ?? '').trim()
}

export function resolveClaimAttachmentDownloadUrl(file: CustomerAppClaimAttachmentFile): string {
  return String(file.downloadUrl ?? file.openUrl ?? file.url ?? '').trim()
}

export function shouldUseDirectClaimAttachmentNavigation(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  if (isCustomerAppNativeWebView()) {
    return true
  }
  try {
    return window.matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}

export function handleOpenClaimAttachment(file: CustomerAppClaimAttachmentFile): void {
  const url = resolveAbsoluteApiUrl(resolveClaimAttachmentOpenUrl(file))
  if (!url) {
    window.alert('파일을 열 수 없습니다.')
    return
  }
  if (shouldUseDirectClaimAttachmentNavigation()) {
    window.location.href = url
    return
  }
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) {
    window.location.href = url
  }
}

export function handleDownloadClaimAttachment(file: CustomerAppClaimAttachmentFile): void {
  const url = resolveAbsoluteApiUrl(resolveClaimAttachmentDownloadUrl(file))
  if (!url) {
    window.alert('파일을 다운로드할 수 없습니다.')
    return
  }
  window.location.href = url
}

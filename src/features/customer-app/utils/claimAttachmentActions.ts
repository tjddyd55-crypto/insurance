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

export function resolveClaimAttachmentOpenHref(file: CustomerAppClaimAttachmentFile): string {
  const href = resolveClaimAttachmentOpenUrl(file)
  return href ? resolveAbsoluteApiUrl(href) : ''
}

export function resolveClaimAttachmentDownloadHref(file: CustomerAppClaimAttachmentFile): string {
  const href = resolveClaimAttachmentDownloadUrl(file)
  return href ? resolveAbsoluteApiUrl(href) : ''
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

export function getClaimAttachmentOpenLinkTarget(): '_self' | '_blank' {
  return shouldUseDirectClaimAttachmentNavigation() ? '_self' : '_blank'
}

export const CLAIM_ATTACHMENT_DOWNLOAD_LINK_TARGET = '_self' as const

import { shouldUseNativeAgentClaimFileLinks } from '../features/claim-requests/utils/claimRequestFileActions'

/** Content-Disposition에서 파일명 추출 (UTF-8 filename* 우선) */
export function parseContentDispositionFilename(headerValue: string | null): string | null {
  if (!headerValue?.trim()) {
    return null
  }
  const utf8Star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;\s]+)/i.exec(headerValue)
  if (utf8Star?.[1]) {
    try {
      return decodeURIComponent(utf8Star[1].trim())
    } catch {
      return null
    }
  }
  const quoted = /filename\s*=\s*"((?:\\.|[^"\\])*)"/i.exec(headerValue)
  if (quoted?.[1]) {
    return quoted[1].replace(/\\(.)/g, '$1')
  }
  const plain = /filename\s*=\s*([^;\s]+)/i.exec(headerValue)
  if (plain?.[1]) {
    return plain[1].replace(/^["']|["']$/g, '')
  }
  return null
}

export class EmptyDownloadFileError extends Error {
  constructor() {
    super('EMPTY_DOWNLOAD_FILE')
    this.name = 'EmptyDownloadFileError'
  }
}

export type DownloadBlobFileOptions = {
  blob: Blob
  fileName: string
  /** 모바일·웹뷰에서는 anchor.download 대신 새 창/탭으로 연다. */
  preferOpenOnMobile?: boolean
}

export function downloadBlobFile({
  blob,
  fileName,
  preferOpenOnMobile = true,
}: DownloadBlobFileOptions): void {
  if (!blob || blob.size === 0) {
    throw new EmptyDownloadFileError()
  }

  const objectUrl = URL.createObjectURL(blob)
  const useMobileFallback = preferOpenOnMobile && shouldUseNativeAgentClaimFileLinks()

  if (useMobileFallback) {
    const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer')
    if (!opened) {
      window.location.assign(objectUrl)
    }
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    return
  }

  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 3000)
}

export async function downloadBlobResponse(response: Response, fallbackFileName: string): Promise<string> {
  if (!response.ok) {
    throw new Error('download failed')
  }
  const blob = await response.blob()
  const fileName = parseContentDispositionFilename(response.headers.get('Content-Disposition')) ?? fallbackFileName
  downloadBlobFile({ blob, fileName })
  return fileName
}

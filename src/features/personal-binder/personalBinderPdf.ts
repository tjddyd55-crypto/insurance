import { ApiError, resolveApiUrl } from '../../lib/apiClient'

function authHeader(token: string | null): string {
  const value = token?.trim()
  if (!value) throw new ApiError('로그인이 필요합니다.', 401)
  return `Bearer ${value}`
}

export async function fetchPersonalBinderPdf(
  token: string | null,
  binderId: string,
): Promise<Blob> {
  const response = await fetch(
    resolveApiUrl(`/api/personal-binders/${binderId}/export`),
    { headers: { Authorization: authHeader(token) } },
  )
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string }
    const message =
      typeof payload.message === 'string' && payload.message.trim()
        ? payload.message.trim()
        : '바인더 PDF를 만들지 못했습니다.'
    throw new ApiError(message, response.status)
  }
  const type = response.headers.get('content-type') ?? ''
  if (!type.includes('application/pdf')) {
    throw new ApiError('바인더 PDF 형식이 올바르지 않습니다.', response.status)
  }
  return response.blob()
}

export function downloadPdfBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function printPdfBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const frame = document.createElement('iframe')
  frame.title = '바인더 인쇄'
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden'
  frame.src = url
  const cleanup = () => {
    frame.remove()
    URL.revokeObjectURL(url)
  }
  frame.onload = () => {
    const win = frame.contentWindow
    win?.focus()
    win?.print()
    win?.addEventListener('afterprint', cleanup, { once: true })
  }
  document.body.appendChild(frame)
  window.setTimeout(cleanup, 120_000)
}

export async function downloadPersonalBinderPdf(
  token: string | null,
  binderId: string,
  fileName: string,
): Promise<void> {
  const blob = await fetchPersonalBinderPdf(token, binderId)
  downloadPdfBlob(blob, fileName)
}

export async function printPersonalBinderPdf(
  token: string | null,
  binderId: string,
): Promise<void> {
  const blob = await fetchPersonalBinderPdf(token, binderId)
  printPdfBlob(blob)
}

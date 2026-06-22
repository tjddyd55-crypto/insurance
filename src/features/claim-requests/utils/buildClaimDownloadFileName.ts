export type ClaimDownloadFileType = 'pdf' | 'zip'

export function sanitizeDownloadFileNamePart(value: string | null | undefined): string {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 40)
  return cleaned || '고객'
}

export function formatDateForFileName(value: string | null | undefined): string {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '')
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

export function buildClaimDownloadFileName(params: {
  customerName: string
  date?: string | null
  type: ClaimDownloadFileType
}): string {
  const safeName = sanitizeDownloadFileNamePart(params.customerName)
  const dateText = formatDateForFileName(params.date)
  if (params.type === 'pdf') {
    return `${safeName}_${dateText}_청구서류.pdf`
  }
  return `${safeName}_${dateText}_원본파일.zip`
}

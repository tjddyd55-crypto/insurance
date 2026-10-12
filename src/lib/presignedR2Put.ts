import { resolveApiUrl } from './apiClient'

const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

export function inferImageContentType(file: File): string {
  const fromFile = String(file.type ?? '').trim().toLowerCase()
  if (IMAGE_MIME.has(fromFile)) {
    return fromFile
  }
  const n = file.name.toLowerCase()
  if (n.endsWith('.png')) {
    return 'image/png'
  }
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) {
    return 'image/jpeg'
  }
  if (n.endsWith('.webp')) {
    return 'image/webp'
  }
  if (n.endsWith('.gif')) {
    return 'image/gif'
  }
  return fromFile || 'application/octet-stream'
}

export async function putFileToPresignedR2Url(
  uploadUrl: string,
  file: File,
  contentType: string,
  putHeaders?: Record<string, string>,
): Promise<void> {
  const url = /^https?:\/\//i.test(uploadUrl) ? uploadUrl : resolveApiUrl(uploadUrl)
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    ...(putHeaders ?? {}),
  }
  let res: Response
  try {
    res = await fetch(url, {
      method: 'PUT',
      headers,
      body: file,
    })
  } catch {
    throw new Error(
      '스토리지로 이미지를 전송하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
    )
  }
  if (!res.ok) {
    throw new Error('이미지 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.')
  }
}

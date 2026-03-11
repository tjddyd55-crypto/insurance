export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface RequestOptions extends RequestInit {
  token?: string | null
}

const API_BASE_PATH =
  (import.meta.env.VITE_API_BASE_PATH as string | undefined)?.replace(/\/$/, '') || '/backend'

function resolveApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  if (path.startsWith('/api/')) {
    return `${API_BASE_PATH}${path.slice('/api'.length)}`
  }

  return path
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options
  let response: Response
  try {
    response = await fetch(resolveApiUrl(path), {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    })
  } catch {
    throw new ApiError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.', 0)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const payload = (await response.json().catch(() => ({}))) as { message?: string }
  if (!response.ok) {
    throw new ApiError(payload.message ?? '요청 처리에 실패했습니다.', response.status)
  }

  return payload as T
}

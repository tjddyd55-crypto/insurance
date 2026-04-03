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

export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  if (path.startsWith('/api/')) {
    // 동일 출처: /backend + /customer/...  →  Express의 app.use('/backend', apiRouter)
    // 절대 API 호스트: /api/... 경로를 그대로 이어 붙임 (잘못된 /customer/... 단독 경로 방지)
    if (/^https?:\/\//.test(API_BASE_PATH)) {
      return `${API_BASE_PATH}${path}`
    }
    return `${API_BASE_PATH}${path.slice('/api'.length)}`
  }

  return path
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options
  const bearer =
    typeof token === 'string' && token.trim() ? `Bearer ${token.trim()}` : ''
  const resolvedUrl = resolveApiUrl(path)
  if (path === '/api/customer/external-create') {
    console.log('[apiRequest] fetch', resolvedUrl, rest.method ?? 'GET')
  }

  let response: Response
  try {
    response = await fetch(resolvedUrl, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: bearer } : {}),
        ...headers,
      },
    })
  } catch {
    throw new ApiError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.', 0)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const payload = (await response.json().catch(() => ({}))) as {
    message?: string
    error?: string
  }
  if (!response.ok) {
    throw new ApiError(
      payload.message ?? payload.error ?? '요청 처리에 실패했습니다.',
      response.status,
    )
  }

  return payload as T
}

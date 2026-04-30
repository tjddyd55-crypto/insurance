/**
 * PDF 자동화 엔진 — HTTP 클라이언트.
 *
 * 역할: URL/메서드/FormData 조립만. 어플리케이션 로직(상태·캐시·메시지)은 호출측이 담당.
 * 이렇게 분리해야 관리자·사용자 UI 가 동일 API 를 다르게 감쌀 수 있다.
 */

import { ApiError, apiRequest, resolveApiUrl } from '../../../lib/apiClient'
import { logger } from '../../../lib/logger'
import type {
  PdfFieldSpec,
  PdfTemplateDetail,
  PdfTemplateSummary,
} from '../types'

/** 선두 4바이트가 `%PDF` 인지 — 개발 로그·본문 검증에 공통 사용 */
function arrayBufferHasPdfMagic(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 4) return false
  const u8 = new Uint8Array(buf, 0, 4)
  return u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46
}

/**
 * 실패 응답을 해석해 ApiError 로 변환한다.
 * JSON body 가 있으면 message/code 를 꺼내고, 없으면 HTTP status 로 대체한다.
 * 이 헬퍼가 있어야 바이너리 엔드포인트(/file, /render) 의 에러도
 * 일관된 형태로 UI/로거에 전달된다.
 */
async function toApiError(
  res: Response,
  fallback: string,
  event: string,
  extra: Record<string, unknown> = {},
): Promise<ApiError> {
  const text = await res.text().catch(() => '')
  let body: { message?: string; code?: string } = {}
  if (text) {
    try {
      body = JSON.parse(text) as typeof body
    } catch {
      /* JSON 아니면 텍스트 그대로 메시지 자리에. */
      body = { message: text.slice(0, 200) }
    }
  }
  logger.error(event, {
    ...extra,
    status: res.status,
    statusText: res.statusText,
    serverMessage: body.message ?? null,
    serverCode: body.code ?? null,
  })
  return new ApiError(body.message ?? fallback, res.status)
}

function authHeader(token: string | null | undefined): Record<string, string> {
  return token?.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}
}

// ─── 관리자 전용 ────────────────────────────────────────────────────

export async function uploadAdminPdfTemplateFile(
  token: string,
  input: { gaId: number | null; file: File },
): Promise<{ storageKey: string; pageCount: number }> {
  const fd = new FormData()
  fd.append('pdf', input.file)
  if (input.gaId != null) fd.append('gaId', String(input.gaId))

  let res: Response
  try {
    res = await fetch(resolveApiUrl('/api/admin/pdf-templates/upload'), {
      method: 'POST',
      headers: { ...authHeader(token) },
      body: fd,
    })
  } catch (networkError) {
    logger.error('pdf-template.upload.network-failed', {
      gaId: input.gaId,
      fileSize: input.file.size,
      error: networkError,
    })
    throw new ApiError('네트워크 오류로 업로드하지 못했습니다.', 0)
  }

  const payload = (await res.json().catch(() => ({}))) as {
    storageKey?: string
    pageCount?: number
    message?: string
  }
  if (!res.ok || !payload.storageKey) {
    logger.error('pdf-template.upload.server-rejected', {
      status: res.status,
      serverMessage: payload.message ?? null,
      gaId: input.gaId,
    })
    throw new ApiError(payload.message ?? 'PDF 업로드 실패', res.status)
  }
  return { storageKey: payload.storageKey, pageCount: Number(payload.pageCount) || 1 }
}

export function createAdminPdfTemplate(
  token: string,
  body: {
    gaId: number | null
    title: string
    description: string
    storageKey: string
    pageCount: number
  },
): Promise<{ template: PdfTemplateSummary }> {
  return apiRequest('/api/admin/pdf-templates', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  })
}

export function listAdminPdfTemplates(
  token: string,
): Promise<{ templates: PdfTemplateSummary[] }> {
  return apiRequest('/api/admin/pdf-templates', { method: 'GET', token })
}

export function getAdminPdfTemplate(
  token: string,
  id: number,
): Promise<PdfTemplateDetail> {
  return apiRequest(`/api/admin/pdf-templates/${id}`, { method: 'GET', token })
}

export function patchAdminPdfTemplate(
  token: string,
  id: number,
  patch: { title?: string; description?: string; isActive?: boolean },
): Promise<{ template: PdfTemplateSummary | null }> {
  return apiRequest(`/api/admin/pdf-templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
    token,
  })
}

export function saveAdminPdfTemplateFields(
  token: string,
  id: number,
  fields: PdfFieldSpec[],
): Promise<{ fields: (PdfFieldSpec & { id: number })[] }> {
  return apiRequest(`/api/admin/pdf-templates/${id}/fields`, {
    method: 'PUT',
    body: JSON.stringify({ fields }),
    token,
  })
}

export async function fetchAdminPdfTemplateFile(
  token: string,
  id: number,
): Promise<ArrayBuffer> {
  const url = resolveApiUrl(`/api/admin/pdf-templates/${id}/file`)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { ...authHeader(token) },
    })
  } catch (networkError) {
    logger.error('pdf-template.file.network-failed', {
      templateId: id,
      url,
      error: networkError,
    })
    throw new ApiError('네트워크 오류로 원본 PDF 를 불러오지 못했습니다.', 0)
  }

  if (!res.ok) {
    throw await toApiError(res, '원본 PDF 를 불러오지 못했습니다.', 'pdf-template.file.http-error', {
      templateId: id,
    })
  }

  const contentType = res.headers.get('content-type') ?? ''
  const contentLengthHeader = res.headers.get('content-length')
  const contentTypeLower = contentType.toLowerCase()
  /*
   * HTML/JSON 이 200 으로 온 경우 pdfjs 가 parse-failed 로만 드러나 사용자 혼란을 키운다.
   * 본문을 읽기 전에 Content-Type 으로 차단한다.
   */
  if (contentTypeLower.includes('text/html') || contentTypeLower.includes('application/json')) {
    logger.error('pdf-template.file.non-pdf-content-type', {
      templateId: id,
      contentType,
      status: res.status,
    })
    throw new ApiError(
      'PDF 파일 대신 다른 응답을 받았습니다. 파일 경로 또는 접근 권한을 확인해주세요.',
      res.status,
    )
  }

  const buffer = await res.arrayBuffer()
  const declaredLength = contentLengthHeader ? Number(contentLengthHeader) : null

  /*
   * 0 바이트 응답은 "형식을 해석할 수 없다(parse-failed)" 로 오해되어 pdfjs 까지 흘러간다.
   * 여기서 명시적 에러로 차단해 UX 메시지와 원인 진단을 모두 정확하게 만든다.
   *
   * 함께 로깅하는 3 요소 — 헤더 content-length / 수신 byteLength / content-type — 이
   * 서로 다르면 중간 경로(Railway edge / 프록시 / Electron 네트워크 스택) 가 범인임이
   * 드러난다. 같다면 서버가 정말 0 바이트를 보낸 것이므로 서버 측 로그와 대조하면 된다.
   */
  if (buffer.byteLength === 0) {
    logger.error('pdf-template.file.empty-body', {
      templateId: id,
      status: res.status,
      contentType,
      declaredLength,
      receivedByteLength: 0,
    })
    throw new ApiError(
      'PDF 파일 데이터를 불러오지 못했습니다. 파일 저장 상태를 확인해주세요.',
      res.status,
    )
  }

  const magicOk = arrayBufferHasPdfMagic(buffer)
  if (logger.isDev && !magicOk && buffer.byteLength >= 4) {
    logger.warn('pdf-template.file.missing-pdf-magic', {
      templateId: id,
      byteLength: buffer.byteLength,
      contentType,
    })
  }

  if (!magicOk) {
    if (contentTypeLower.includes('pdf')) {
      logger.error('pdf-template.file.invalid-pdf-magic-declared-pdf', {
        templateId: id,
        byteLength: buffer.byteLength,
        contentType,
      })
      throw new ApiError(
        'PDF 파일을 불러오지 못했습니다. 파일이 손상되었거나 지원되지 않는 형식일 수 있습니다.',
        res.status,
      )
    }
    logger.error('pdf-template.file.invalid-pdf-magic', {
      templateId: id,
      byteLength: buffer.byteLength,
      contentType,
    })
    throw new ApiError(
      'PDF 파일 대신 다른 응답을 받았습니다. 파일 경로 또는 접근 권한을 확인해주세요.',
      res.status,
    )
  }

  /*
   * 정상 케이스도 info 로 한 줄 남긴다 — 문제 발생 시 "직전 성공" 과 비교하기 위한 기준선.
   * 프로덕션 debug 는 조용히 버려지므로 용량 부담은 없다.
   */
  logger.debug('pdf-template.file.loaded', {
    templateId: id,
    status: res.status,
    contentType,
    declaredLength,
    receivedByteLength: buffer.byteLength,
  })
  return buffer
}

export function deleteAdminPdfTemplate(token: string, id: number): Promise<void> {
  return apiRequest(`/api/admin/pdf-templates/${id}`, {
    method: 'DELETE',
    token,
  })
}

// ─── 사용자 ───────────────────────────────────────────────────────────

export function listPdfTemplates(token: string): Promise<{ templates: PdfTemplateSummary[] }> {
  return apiRequest('/api/pdf-templates', { method: 'GET', token })
}

export function getPdfTemplate(token: string, id: number): Promise<PdfTemplateDetail> {
  return apiRequest(`/api/pdf-templates/${id}`, { method: 'GET', token })
}

// ─── 발급 이력(사용자/관리자 공용) ───────────────────────────────────

export interface PdfIssuanceSummary {
  id: number
  templateId: number | null
  userId: string | null
  gaId: number | null
  templateCode: string
  templateTitle: string
  byteLength: number
  createdAt: string
}

export function listPdfIssuances(
  token: string,
): Promise<{ issuances: PdfIssuanceSummary[] }> {
  return apiRequest('/api/pdf-issuances', { method: 'GET', token })
}

/**
 * 보관된 PDF 를 바이너리로 받는다.
 * 서버 측에서 본인 여부/관리자 여부를 검사하므로 프론트는 요청만 한다.
 */
export async function fetchPdfIssuanceFile(token: string, id: number): Promise<Blob> {
  const url = resolveApiUrl(`/api/pdf-issuances/${id}/file`)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { ...authHeader(token) },
    })
  } catch (networkError) {
    logger.error('pdf-issuance.file.network-failed', {
      issuanceId: id,
      error: networkError,
    })
    throw new ApiError('네트워크 오류로 보관된 PDF 를 불러오지 못했습니다.', 0)
  }

  if (!res.ok) {
    throw await toApiError(res, '보관된 PDF 를 불러오지 못했습니다.', 'pdf-issuance.file.http-error', {
      issuanceId: id,
    })
  }
  return res.blob()
}

/**
 * 입력값을 전송하고 스탬핑된 PDF 바이너리를 받는다.
 * 브라우저에서 다운로드 트리거는 호출측에서 Blob + anchor 로 처리.
 */
export async function renderPdfTemplate(
  token: string,
  id: number,
  values: Record<string, string>,
  options?: { preview?: boolean },
): Promise<Blob> {
  const query = options?.preview ? '?preview=1' : ''
  const url = resolveApiUrl(`/api/pdf-templates/${id}/render${query}`)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ values }),
    })
  } catch (networkError) {
    logger.error('pdf-template.render.network-failed', {
      templateId: id,
      valueKeys: Object.keys(values),
      error: networkError,
    })
    throw new ApiError('네트워크 오류로 PDF 를 생성하지 못했습니다.', 0)
  }

  if (!res.ok) {
    throw await toApiError(res, 'PDF 생성 실패', 'pdf-template.render.http-error', {
      templateId: id,
      valueKeys: Object.keys(values),
    })
  }
  return res.blob()
}

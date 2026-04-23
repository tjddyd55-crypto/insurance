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

  /* 응답이 PDF 인지 Content-Type 으로 가볍게 확인한다. HTML 에러페이지가
     200 으로 섞여 들어오는 엣지 케이스(프록시/게이트웨이)를 잡기 위함. */
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('pdf')) {
    logger.warn('pdf-template.file.unexpected-content-type', {
      templateId: id,
      contentType,
    })
  }
  return res.arrayBuffer()
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

/**
 * 입력값을 전송하고 스탬핑된 PDF 바이너리를 받는다.
 * 브라우저에서 다운로드 트리거는 호출측에서 Blob + anchor 로 처리.
 */
export async function renderPdfTemplate(
  token: string,
  id: number,
  values: Record<string, string>,
): Promise<Blob> {
  const url = resolveApiUrl(`/api/pdf-templates/${id}/render`)
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

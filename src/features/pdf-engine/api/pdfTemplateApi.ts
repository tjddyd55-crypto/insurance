/**
 * PDF 자동화 엔진 — HTTP 클라이언트.
 *
 * 역할: URL/메서드/FormData 조립만. 어플리케이션 로직(상태·캐시·메시지)은 호출측이 담당.
 * 이렇게 분리해야 관리자·사용자 UI 가 동일 API 를 다르게 감쌀 수 있다.
 */

import { ApiError, apiRequest, resolveApiUrl } from '../../../lib/apiClient'
import type {
  PdfFieldSpec,
  PdfTemplateDetail,
  PdfTemplateSummary,
} from '../types'

function authHeader(token: string | null | undefined): Record<string, string> {
  return token?.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}
}

// ─── 관리자 전용 ────────────────────────────────────────────────────

export async function uploadAdminPdfTemplateFile(
  token: string,
  input: { gaId: number | null; code: string; file: File },
): Promise<{ storageKey: string; pageCount: number }> {
  const fd = new FormData()
  fd.append('pdf', input.file)
  if (input.gaId != null) fd.append('gaId', String(input.gaId))
  fd.append('code', input.code)

  const res = await fetch(resolveApiUrl('/api/admin/pdf-templates/upload'), {
    method: 'POST',
    headers: { ...authHeader(token) },
    body: fd,
  })
  const payload = (await res.json().catch(() => ({}))) as {
    storageKey?: string
    pageCount?: number
    message?: string
  }
  if (!res.ok || !payload.storageKey) {
    throw new ApiError(payload.message ?? 'PDF 업로드 실패', res.status)
  }
  return { storageKey: payload.storageKey, pageCount: Number(payload.pageCount) || 1 }
}

export function createAdminPdfTemplate(
  token: string,
  body: {
    gaId: number | null
    code: string
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
  const res = await fetch(resolveApiUrl(`/api/admin/pdf-templates/${id}/file`), {
    method: 'GET',
    headers: { ...authHeader(token) },
  })
  if (!res.ok) {
    throw new ApiError('원본 PDF 를 불러오지 못했습니다.', res.status)
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
  const res = await fetch(resolveApiUrl(`/api/pdf-templates/${id}/render`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify({ values }),
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { message?: string }
    throw new ApiError(payload.message ?? 'PDF 생성 실패', res.status)
  }
  return res.blob()
}

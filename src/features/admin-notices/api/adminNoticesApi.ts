import { apiRequest, resolveApiUrl } from '../../../lib/apiClient'
import type { AdminNoticeConsoleVariant } from '../adminNoticeConsole'
import { adminNoticeApiRoot } from '../adminNoticeConsole'
import type { AdminNotice, AdminNoticeFormState } from '../types/adminNotice.types'

export type AdminNoticeImagePresignResult = {
  uploadUrl: string
  publicUrl: string
  storageKey: string
  contentType: string
}

export type AdminNoticeLinkPreview = {
  url: string
  title: string
  description: string
  image: string
  siteName: string
  domain: string
}

function serializeNoticeBody(form: AdminNoticeFormState) {
  return {
    title: form.title,
    contentHtml: form.contentHtml,
    status: form.status,
    showAsPopup: form.showAsPopup,
    popupPriority: form.popupPriority,
    startsAt: form.startsAt.trim() ? new Date(form.startsAt).toISOString() : null,
    endsAt: form.endsAt.trim() ? new Date(form.endsAt).toISOString() : null,
  }
}

function assertNotice(notice: AdminNotice | null | undefined, message: string): AdminNotice {
  if (!notice?.id) {
    throw new Error(message)
  }
  return notice
}

async function presignNoticeImage(
  token: string,
  file: File,
  variant: AdminNoticeConsoleVariant,
  noticeId?: number | null,
): Promise<AdminNoticeImagePresignResult> {
  const root = adminNoticeApiRoot(variant)
  const path =
    noticeId != null && Number.isFinite(noticeId) && noticeId > 0
      ? `${root}/${noticeId}/images/presign`
      : `${root}/images/presign`
  const presign = await apiRequest<AdminNoticeImagePresignResult>(path, {
    token,
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }),
  })
  if (!presign?.uploadUrl || !presign.publicUrl || !presign.storageKey) {
    throw new Error('이미지 업로드 URL을 발급받지 못했습니다.')
  }
  return presign
}

export async function uploadAdminNoticeImage(
  token: string,
  file: File,
  noticeId?: number | null,
  variant: AdminNoticeConsoleVariant = 'platform',
): Promise<string> {
  const presign = await presignNoticeImage(token, file, variant, noticeId)
  const uploadUrl = /^https?:\/\//i.test(presign.uploadUrl) ? presign.uploadUrl : resolveApiUrl(presign.uploadUrl)
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': presign.contentType || file.type || 'application/octet-stream' },
    body: file,
  })
  if (!uploadRes.ok) {
    throw new Error('이미지 업로드에 실패했습니다.')
  }
  if (!presign.storageKey.startsWith('insurance/admin-notices/')) {
    throw new Error('이미지 저장 경로가 올바르지 않습니다.')
  }
  return presign.publicUrl
}

export async function fetchAdminNotices(
  token: string,
  variant: AdminNoticeConsoleVariant = 'platform',
): Promise<AdminNotice[]> {
  const notices = await apiRequest<AdminNotice[]>(adminNoticeApiRoot(variant), { token })
  return Array.isArray(notices) ? notices : []
}

export async function fetchAdminNotice(
  token: string,
  id: number,
  variant: AdminNoticeConsoleVariant = 'platform',
): Promise<AdminNotice> {
  return assertNotice(
    await apiRequest<AdminNotice>(`${adminNoticeApiRoot(variant)}/${id}`, { token }),
    '공지를 불러오지 못했습니다.',
  )
}

export async function createAdminNotice(
  token: string,
  form: AdminNoticeFormState,
  variant: AdminNoticeConsoleVariant = 'platform',
): Promise<AdminNotice> {
  return assertNotice(
    await apiRequest<AdminNotice>(adminNoticeApiRoot(variant), {
      token,
      method: 'POST',
      body: JSON.stringify(serializeNoticeBody(form)),
    }),
    '공지 저장 결과에 ID가 없습니다.',
  )
}

export async function updateAdminNotice(
  token: string,
  id: number,
  form: AdminNoticeFormState,
  variant: AdminNoticeConsoleVariant = 'platform',
): Promise<AdminNotice> {
  return assertNotice(
    await apiRequest<AdminNotice>(`${adminNoticeApiRoot(variant)}/${id}`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(serializeNoticeBody(form)),
    }),
    '공지 저장 결과에 ID가 없습니다.',
  )
}

export async function deleteAdminNotice(
  token: string,
  id: number,
  variant: AdminNoticeConsoleVariant = 'platform',
): Promise<void> {
  await apiRequest(`${adminNoticeApiRoot(variant)}/${id}`, { token, method: 'DELETE' })
}

export async function publishAdminNotice(
  token: string,
  id: number,
  variant: AdminNoticeConsoleVariant = 'platform',
): Promise<AdminNotice> {
  return assertNotice(
    await apiRequest<AdminNotice>(`${adminNoticeApiRoot(variant)}/${id}/publish`, {
      token,
      method: 'POST',
    }),
    '공지 게시 결과에 ID가 없습니다.',
  )
}

export async function archiveAdminNotice(
  token: string,
  id: number,
  variant: AdminNoticeConsoleVariant = 'platform',
): Promise<AdminNotice> {
  return assertNotice(
    await apiRequest<AdminNotice>(`${adminNoticeApiRoot(variant)}/${id}/archive`, {
      token,
      method: 'POST',
    }),
    '공지 보관 결과에 ID가 없습니다.',
  )
}

export async function setAdminNoticePopup(
  token: string,
  id: number,
  variant: AdminNoticeConsoleVariant = 'platform',
): Promise<AdminNotice> {
  return assertNotice(
    await apiRequest<AdminNotice>(`${adminNoticeApiRoot(variant)}/${id}/set-popup`, {
      token,
      method: 'POST',
    }),
    '공지 팝업 설정 결과에 ID가 없습니다.',
  )
}

export async function fetchAdminNoticeLinkPreview(
  token: string,
  url: string,
  variant: AdminNoticeConsoleVariant = 'platform',
): Promise<AdminNoticeLinkPreview | null> {
  const preview = await apiRequest<AdminNoticeLinkPreview | null>(`${adminNoticeApiRoot(variant)}/link-preview`, {
    token,
    method: 'POST',
    body: JSON.stringify({ url }),
  })
  if (!preview || typeof preview !== 'object' || !preview.url) {
    return null
  }
  return preview
}

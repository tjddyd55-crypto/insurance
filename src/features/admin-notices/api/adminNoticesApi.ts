import { apiRequest, resolveApiUrl } from '../../../lib/apiClient'
import type { AdminNotice, AdminNoticeFormState } from '../types/adminNotice.types'

export type AdminNoticeImagePresignResult = {
  uploadUrl: string
  publicUrl: string
  storageKey: string
  contentType: string
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
  noticeId?: number | null,
): Promise<AdminNoticeImagePresignResult> {
  const path =
    noticeId != null && Number.isFinite(noticeId) && noticeId > 0
      ? `/api/admin/notices/${noticeId}/images/presign`
      : '/api/admin/notices/images/presign'
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

export async function uploadAdminNoticeImage(token: string, file: File, noticeId?: number | null): Promise<string> {
  const presign = await presignNoticeImage(token, file, noticeId)
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

export async function fetchAdminNotices(token: string): Promise<AdminNotice[]> {
  const notices = await apiRequest<AdminNotice[]>('/api/admin/notices', { token })
  return Array.isArray(notices) ? notices : []
}

export async function fetchAdminNotice(token: string, id: number): Promise<AdminNotice> {
  return assertNotice(
    await apiRequest<AdminNotice>(`/api/admin/notices/${id}`, { token }),
    '공지를 불러오지 못했습니다.',
  )
}

export async function createAdminNotice(token: string, form: AdminNoticeFormState): Promise<AdminNotice> {
  return assertNotice(
    await apiRequest<AdminNotice>('/api/admin/notices', {
      token,
      method: 'POST',
      body: JSON.stringify(serializeNoticeBody(form)),
    }),
    '공지 저장 결과에 ID가 없습니다.',
  )
}

export async function updateAdminNotice(token: string, id: number, form: AdminNoticeFormState): Promise<AdminNotice> {
  return assertNotice(
    await apiRequest<AdminNotice>(`/api/admin/notices/${id}`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(serializeNoticeBody(form)),
    }),
    '공지 저장 결과에 ID가 없습니다.',
  )
}

export async function deleteAdminNotice(token: string, id: number): Promise<void> {
  await apiRequest(`/api/admin/notices/${id}`, { token, method: 'DELETE' })
}

export async function publishAdminNotice(token: string, id: number): Promise<AdminNotice> {
  return assertNotice(
    await apiRequest<AdminNotice>(`/api/admin/notices/${id}/publish`, {
      token,
      method: 'POST',
    }),
    '공지 게시 결과에 ID가 없습니다.',
  )
}

export async function archiveAdminNotice(token: string, id: number): Promise<AdminNotice> {
  return assertNotice(
    await apiRequest<AdminNotice>(`/api/admin/notices/${id}/archive`, {
      token,
      method: 'POST',
    }),
    '공지 보관 결과에 ID가 없습니다.',
  )
}

export async function setAdminNoticePopup(token: string, id: number): Promise<AdminNotice> {
  return assertNotice(
    await apiRequest<AdminNotice>(`/api/admin/notices/${id}/set-popup`, {
      token,
      method: 'POST',
    }),
    '공지 팝업 설정 결과에 ID가 없습니다.',
  )
}

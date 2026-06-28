import { apiRequest, resolveApiUrl } from '../../../lib/apiClient'
import type { AdminNotice, AdminNoticeFormState } from '../types/adminNotice.types'

type NoticeListResponse = { success: boolean; data: AdminNotice[] }
type NoticeItemResponse = { success: boolean; data: AdminNotice }

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

async function presignNoticeImage(
  token: string,
  file: File,
  noticeId?: number | null,
): Promise<{ uploadUrl: string; storageKey: string; publicUrl: string; contentType: string }> {
  const path =
    noticeId != null && Number.isFinite(noticeId) && noticeId > 0
      ? `/api/admin/notices/${noticeId}/images/presign`
      : '/api/admin/notices/images/presign'
  const res = (await apiRequest(path, {
    token,
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }),
  })) as {
    success: boolean
    data: { uploadUrl: string; storageKey: string; publicUrl: string; contentType: string }
  }
  return res.data
}

export async function uploadAdminNoticeImage(token: string, file: File, noticeId?: number | null): Promise<string> {
  const presign = await presignNoticeImage(token, file, noticeId)
  const uploadRes = await fetch(resolveApiUrl(presign.uploadUrl), {
    method: 'PUT',
    headers: { 'Content-Type': presign.contentType },
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
  const res = (await apiRequest('/api/admin/notices', { token })) as NoticeListResponse
  return res.data ?? []
}

export async function fetchAdminNotice(token: string, id: number): Promise<AdminNotice> {
  const res = (await apiRequest(`/api/admin/notices/${id}`, { token })) as NoticeItemResponse
  return res.data
}

export async function createAdminNotice(token: string, form: AdminNoticeFormState): Promise<AdminNotice> {
  const res = (await apiRequest('/api/admin/notices', {
    token,
    method: 'POST',
    body: JSON.stringify(serializeNoticeBody(form)),
  })) as NoticeItemResponse
  return res.data
}

export async function updateAdminNotice(token: string, id: number, form: AdminNoticeFormState): Promise<AdminNotice> {
  const res = (await apiRequest(`/api/admin/notices/${id}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(serializeNoticeBody(form)),
  })) as NoticeItemResponse
  return res.data
}

export async function deleteAdminNotice(token: string, id: number): Promise<void> {
  await apiRequest(`/api/admin/notices/${id}`, { token, method: 'DELETE' })
}

export async function publishAdminNotice(token: string, id: number): Promise<AdminNotice> {
  const res = (await apiRequest(`/api/admin/notices/${id}/publish`, {
    token,
    method: 'POST',
  })) as NoticeItemResponse
  return res.data
}

export async function archiveAdminNotice(token: string, id: number): Promise<AdminNotice> {
  const res = (await apiRequest(`/api/admin/notices/${id}/archive`, {
    token,
    method: 'POST',
  })) as NoticeItemResponse
  return res.data
}

export async function setAdminNoticePopup(token: string, id: number): Promise<AdminNotice> {
  const res = (await apiRequest(`/api/admin/notices/${id}/set-popup`, {
    token,
    method: 'POST',
  })) as NoticeItemResponse
  return res.data
}

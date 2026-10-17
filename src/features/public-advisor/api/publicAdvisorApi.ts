import { apiRequest, resolveApiUrl } from '../../../lib/apiClient'
import { putFileToPresignedR2Url } from '../../../lib/presignedR2Put'

export type VerificationBadge = { id: string; label: string }

export type PublicAdvisorCard = {
  slug: string
  displayName: string
  gaName: string | null
  teamName: string | null
  headline: string
  hashtags: string[]
  profilePhotoUrl: string | null
  officeLine: string
  verificationBadges?: VerificationBadge[]
}

export type AdvisorProfileTheme = 'classic' | 'brand' | 'premium'

export type PublicAdvisorDetail = PublicAdvisorCard & {
  profileTheme?: AdvisorProfileTheme
  heroDisplayEyebrow?: string | null
  heroDisplayTitle?: string | null
  heroDisplaySubtitle?: string | null
  heroDisplayEyebrowVisible?: boolean
  heroDisplayTitleVisible?: boolean
  heroDisplaySubtitleVisible?: boolean
  publicPhone?: string
  publicFax?: string
  publicEmail?: string
  showPublicPhone?: boolean
  showPublicFax?: boolean
  showPublicEmail?: boolean
  customContacts?: Array<{
    id: string
    label: string
    value: string
    contactType: string
  }>
  businessCardFrontUrl?: string | null
  businessCardBackUrl?: string | null
  bio: string
  titleLabel: string | null
  careerText: string
  phoneNumber: string
  kakaoLink: string
  allowConsultation: boolean
  gallery: Array<{ id: string; caption: string; sortOrder: number; imageUrl: string | null }>
  verificationBadges: VerificationBadge[]
}

export const ADVISOR_PUBLIC_EVENT = {
  PHONE_CLICK: 'PHONE_CLICK',
  CONTACT_CLICK: 'CONTACT_CLICK',
  CONSULTATION_START: 'CONSULTATION_START',
  SHARE_CLICK: 'SHARE_CLICK',
  QR_VIEW: 'QR_VIEW',
} as const

export function trackAdvisorPublicEvent(slug: string, eventType: string) {
  void apiRequest(`/api/public/advisors/${encodeURIComponent(slug)}/events`, {
    method: 'POST',
    body: JSON.stringify({ eventType }),
  }).catch(() => {})
}

export async function fetchPublicExperts(q: string): Promise<PublicAdvisorCard[]> {
  const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
  const data = await apiRequest<{ items: PublicAdvisorCard[] }>(`/api/public/experts${query}`)
  return data.items ?? []
}

export async function fetchPublicAdvisorBySlug(slug: string): Promise<PublicAdvisorDetail> {
  return apiRequest<PublicAdvisorDetail>(`/api/public/advisors/${encodeURIComponent(slug)}`)
}

export type OwnerPublicProfileResponse = {
  profile: Record<string, unknown>
  user: { displayName: string; gaName: string; teamName: string; phoneNumber: string }
  gallery: Array<{ id: string; caption: string; sortOrder: number; objectKey: string; imageUrl: string | null }>
  verificationBadges: Array<{ id: string; label: string }>
  publicUrl: string
  profilePhotoUrl: string | null
  businessCardFrontUrl: string | null
  businessCardBackUrl: string | null
  customContacts?: Array<{
    id: string
    label: string
    value: string
    contactType: string
    isVisible: boolean
    sortOrder: number
  }>
}

export async function fetchMyPublicProfile(token: string): Promise<OwnerPublicProfileResponse> {
  return apiRequest<OwnerPublicProfileResponse>('/api/me/public-profile', { token })
}

export async function patchMyPublicProfile(token: string, body: Record<string, unknown>) {
  return apiRequest<{ profile: Record<string, unknown> }>('/api/me/public-profile', {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function presignAdvisorMedia(
  token: string,
  body: {
    kind: 'profile' | 'gallery' | 'business-card-front' | 'business-card-back'
    fileName: string
    contentType: string
    sizeBytes: number
  },
) {
  return apiRequest<{
    uploadUrl: string
    objectKey: string
    contentType: string
    putHeaders?: Record<string, string>
    publicUrl?: string
  }>('/api/me/public-profile/media/presign', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

async function uploadAdvisorImageViaProxy(
  token: string,
  objectKey: string,
  kind: 'profile' | 'gallery' | 'business-card-front' | 'business-card-back',
  file: File,
  contentType: string,
): Promise<void> {
  const q = new URLSearchParams({
    objectKey,
    kind,
    contentType,
  })
  const res = await fetch(resolveApiUrl(`/api/me/public-profile/media/upload-proxy?${q}`), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
    },
    body: file,
  })
  if (!res.ok) {
    throw new Error('이미지 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.')
  }
}

export type AdvisorMediaUploadKind =
  | 'profile'
  | 'gallery'
  | 'business-card-front'
  | 'business-card-back'

export type AdvisorImageUploadResult = {
  objectKey: string
  publicUrl: string | null
}

export async function uploadAdvisorImageFile(
  token: string,
  kind: AdvisorMediaUploadKind,
  file: File,
): Promise<AdvisorImageUploadResult> {
  const contentType = file.type || 'image/jpeg'
  const presign = await presignAdvisorMedia(token, {
    kind,
    fileName: file.name,
    contentType,
    sizeBytes: file.size,
  })
  try {
    await putFileToPresignedR2Url(
      presign.uploadUrl,
      file,
      presign.contentType,
      presign.putHeaders ?? undefined,
    )
  } catch {
    await uploadAdvisorImageViaProxy(token, presign.objectKey, kind, file, presign.contentType)
  }
  return {
    objectKey: presign.objectKey,
    publicUrl: presign.publicUrl ?? null,
  }
}

export async function addAdvisorGalleryItem(token: string, objectKey: string, caption?: string) {
  return apiRequest<{ item: OwnerGalleryItem }>('/api/me/public-profile/gallery', {
    method: 'POST',
    token,
    body: JSON.stringify({ objectKey, caption }),
  })
}

export async function deleteAdvisorGalleryItem(token: string, galleryId: string) {
  return apiRequest<{ ok: boolean }>(`/api/me/public-profile/gallery/${encodeURIComponent(galleryId)}`, {
    method: 'DELETE',
    token,
  })
}

export async function reorderAdvisorGallery(token: string, orderedIds: string[]) {
  return apiRequest<{ ok: boolean }>('/api/me/public-profile/gallery/reorder', {
    method: 'PUT',
    token,
    body: JSON.stringify({ orderedIds }),
  })
}

export type OwnerGalleryItem = {
  id: string
  caption: string
  sortOrder: number
  objectKey: string
  imageUrl: string | null
}

export async function submitAdvisorConsultation(
  slug: string,
  body: {
    name: string
    phone: string
    message: string
    contactChannel: 'phone' | 'sms' | 'kakao'
    privacyConsent: boolean
  },
) {
  return apiRequest<{ ok: boolean; id: string }>(`/api/public/advisors/${encodeURIComponent(slug)}/consultations`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

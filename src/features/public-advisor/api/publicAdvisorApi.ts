import { apiRequest } from '../../../lib/apiClient'

export type PublicAdvisorCard = {
  slug: string
  displayName: string
  gaName: string | null
  teamName: string | null
  headline: string
  hashtags: string[]
  profilePhotoUrl: string | null
  officeLine: string
}

export type PublicAdvisorDetail = PublicAdvisorCard & {
  bio: string
  titleLabel: string
  careerText: string
  phoneNumber: string
  kakaoLink: string
  allowConsultation: boolean
  gallery: Array<{ id: string; caption: string; sortOrder: number; imageUrl: string | null }>
  verificationBadges: Array<{ id: string; label: string }>
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

import { ApiError, apiRequest } from '../../../lib/apiClient'
import type { IntroContactFormValues } from '../components/introduction/landing/introContactFormValidation'

export type PublicInquirySubmitPayload = {
  inquiryType: string
  name: string
  phone: string
  organizationName?: string
  email?: string
  preferredContactTime?: string
  message: string
  privacyConsent: boolean
  companyWebsite?: string
}

export type PublicInquirySubmitResult = {
  inquiryId: string
  createdAt: string
}

/**
 * 소개 랜딩 문의 폼 값을 API 페이로드로 변환한다.
 */
export function toPublicInquiryPayload(values: IntroContactFormValues): PublicInquirySubmitPayload {
  return {
    inquiryType: values.inquiryType,
    name: values.name,
    phone: values.phone,
    organizationName: values.organizationName.trim() || undefined,
    email: values.email.trim() || undefined,
    preferredContactTime: values.preferredContactTime || undefined,
    message: values.message,
    privacyConsent: values.privacyConsent,
    companyWebsite: values.companyWebsite,
  }
}

/**
 * 공개 도입 문의 접수 (인증 불필요).
 * 성공 시 apiClient 가 `{ success, data }` 에서 data 만 언랩한다.
 */
export async function submitPublicInquiry(
  payload: PublicInquirySubmitPayload,
): Promise<PublicInquirySubmitResult> {
  const result = await apiRequest<PublicInquirySubmitResult>('/api/public/inquiries', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!result || typeof result !== 'object' || !('inquiryId' in result)) {
    throw new ApiError('문의 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.', 500)
  }

  return {
    inquiryId: String(result.inquiryId),
    createdAt: String(result.createdAt ?? ''),
  }
}

export function isPublicInquiryRateLimited(error: unknown): boolean {
  return error instanceof ApiError && error.status === 429
}

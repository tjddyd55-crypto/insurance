/**
 * 공개 문의 본문 검증·정규화 (순수 함수).
 * API 핸들러와 단위 테스트가 공유한다.
 */

export const PUBLIC_INQUIRY_TYPES = Object.freeze([
  'FC_PERSONAL',
  'BRANCH_ADOPTION',
  'INSURER_NEWS',
  'CUSTOMER_APP',
  'PRICING',
  'FEATURE',
  'INSTALL',
  'OTHER',
])

export const PUBLIC_CONTACT_TIMES = Object.freeze(['MORNING', 'AFTERNOON', 'EVENING', 'ANYTIME'])

export const PUBLIC_INQUIRY_LIMITS = Object.freeze({
  nameMin: 2,
  nameMax: 50,
  organizationNameMax: 100,
  emailMax: 254,
  messageMin: 5,
  messageMax: 2000,
  phoneDigitsMin: 10,
  phoneDigitsMax: 11,
})

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizePhone(value) {
  return String(value ?? '').replace(/\D/g, '')
}

/**
 * digits-only → 표시용 하이픈 포맷.
 * @param {string} digits
 * @returns {string}
 */
export function formatPhoneDisplay(digits) {
  const d = normalizePhone(digits)
  if (d.length === 11) {
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  }
  if (d.length === 10) {
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  }
  return d
}

/**
 * 중복 검사용 메시지 정규화.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeMessageForHash(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * @typedef {{
 *   ok: true,
 *   value: {
 *     inquiryType: string,
 *     name: string,
 *     phoneNormalized: string,
 *     phoneDisplay: string,
 *     organizationName: string | null,
 *     email: string | null,
 *     preferredContactTime: string | null,
 *     message: string,
 *     privacyConsent: true,
 *     companyWebsite: string,
 *   }
 * }} PublicInquiryValidationOk
 *
 * @typedef {{
 *   ok: false,
 *   code: string,
 *   message: string,
 * }} PublicInquiryValidationErr
 */

/**
 * @param {unknown} body
 * @returns {PublicInquiryValidationOk | PublicInquiryValidationErr}
 */
export function validatePublicInquiryBody(body) {
  const raw = body && typeof body === 'object' ? /** @type {Record<string, unknown>} */ (body) : {}

  const companyWebsite = String(raw.companyWebsite ?? '').trim()

  const name = String(raw.name ?? '').trim()
  if (name.length < PUBLIC_INQUIRY_LIMITS.nameMin || name.length > PUBLIC_INQUIRY_LIMITS.nameMax) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: `이름은 ${PUBLIC_INQUIRY_LIMITS.nameMin}~${PUBLIC_INQUIRY_LIMITS.nameMax}자로 입력해 주세요.`,
    }
  }

  const phoneNormalized = normalizePhone(raw.phone)
  const { phoneDigitsMin, phoneDigitsMax } = PUBLIC_INQUIRY_LIMITS
  if (phoneNormalized.length < phoneDigitsMin || phoneNormalized.length > phoneDigitsMax) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: '연락처를 정확히 입력해 주세요.',
    }
  }

  const organizationRaw = String(raw.organizationName ?? '').trim()
  if (organizationRaw.length > PUBLIC_INQUIRY_LIMITS.organizationNameMax) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: `소속은 ${PUBLIC_INQUIRY_LIMITS.organizationNameMax}자 이내로 입력해 주세요.`,
    }
  }

  const emailRaw = String(raw.email ?? '').trim()
  if (emailRaw) {
    if (emailRaw.length > PUBLIC_INQUIRY_LIMITS.emailMax) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: `이메일은 ${PUBLIC_INQUIRY_LIMITS.emailMax}자 이내로 입력해 주세요.`,
      }
    }
    if (!EMAIL_PATTERN.test(emailRaw)) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '이메일 형식을 확인해 주세요.',
      }
    }
  }

  const preferredRaw = String(raw.preferredContactTime ?? '').trim()
  if (preferredRaw && !PUBLIC_CONTACT_TIMES.includes(preferredRaw)) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: '연락 가능 시간을 확인해 주세요.',
    }
  }

  const inquiryType = String(raw.inquiryType ?? '').trim()
  if (!PUBLIC_INQUIRY_TYPES.includes(inquiryType)) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: '문의 유형을 선택해 주세요.',
    }
  }

  const message = String(raw.message ?? '').trim()
  if (message.length < PUBLIC_INQUIRY_LIMITS.messageMin) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: `문의 내용을 ${PUBLIC_INQUIRY_LIMITS.messageMin}자 이상 입력해 주세요.`,
    }
  }
  if (message.length > PUBLIC_INQUIRY_LIMITS.messageMax) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: `문의 내용은 ${PUBLIC_INQUIRY_LIMITS.messageMax}자 이내로 입력해 주세요.`,
    }
  }

  if (raw.privacyConsent !== true) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: '개인정보 수집·이용에 동의해 주세요.',
    }
  }

  return {
    ok: true,
    value: {
      inquiryType,
      name,
      phoneNormalized,
      phoneDisplay: formatPhoneDisplay(phoneNormalized),
      organizationName: organizationRaw || null,
      email: emailRaw || null,
      preferredContactTime: preferredRaw || null,
      message,
      privacyConsent: true,
      companyWebsite,
    },
  }
}

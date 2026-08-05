import type { IntroContactTime, IntroInquiryType } from '../../../config/introductionLandingContent'

/**
 * 문의 폼의 순수 검증 로직.
 *
 * UI(React) 와 분리해 둔 이유:
 *   - 2단계에서 서버 API 가 붙어도 클라이언트 검증 규칙은 그대로 재사용한다.
 *   - 규칙 단위 테스트가 렌더링 없이 가능하다.
 * 규칙을 바꿀 때는 이 파일만 수정하면 된다.
 */

export type IntroContactFormValues = {
  name: string
  phone: string
  organizationName: string
  email: string
  inquiryType: IntroInquiryType | ''
  preferredContactTime: IntroContactTime | ''
  message: string
  privacyConsent: boolean
  /** 봇 트랩(honeypot). 사람이 채우면 안 되는 필드. */
  companyWebsite: string
}

export type IntroContactFormField = keyof IntroContactFormValues
export type IntroContactFormErrors = Partial<Record<IntroContactFormField, string>>

export const INTRO_CONTACT_FORM_INITIAL_VALUES: IntroContactFormValues = {
  name: '',
  phone: '',
  organizationName: '',
  email: '',
  inquiryType: '',
  preferredContactTime: '',
  message: '',
  privacyConsent: false,
  companyWebsite: '',
}

export const INTRO_CONTACT_FORM_LIMITS = {
  nameMin: 2,
  nameMax: 50,
  organizationNameMax: 100,
  emailMax: 254,
  messageMin: 5,
  messageMax: 2000,
  phoneDigitsMin: 10,
  phoneDigitsMax: 11,
} as const

/** 최소 형태 검사만 한다. 정확한 유효성은 실제 발송 단계에서 판별된다. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldValidator = (values: IntroContactFormValues) => string | undefined

function digitsOf(value: string): string {
  return value.replace(/\D/g, '')
}

const validateName: FieldValidator = ({ name }) => {
  const trimmed = name.trim()
  if (!trimmed) return '이름을 입력해 주세요.'
  if (trimmed.length < INTRO_CONTACT_FORM_LIMITS.nameMin) {
    return `이름은 ${INTRO_CONTACT_FORM_LIMITS.nameMin}자 이상 입력해 주세요.`
  }
  if (trimmed.length > INTRO_CONTACT_FORM_LIMITS.nameMax) {
    return `이름은 ${INTRO_CONTACT_FORM_LIMITS.nameMax}자 이내로 입력해 주세요.`
  }
  return undefined
}

const validatePhone: FieldValidator = ({ phone }) => {
  const digits = digitsOf(phone)
  if (!digits) return '연락처를 입력해 주세요.'
  const { phoneDigitsMin, phoneDigitsMax } = INTRO_CONTACT_FORM_LIMITS
  if (digits.length < phoneDigitsMin || digits.length > phoneDigitsMax) {
    return '연락처를 정확히 입력해 주세요.'
  }
  return undefined
}

const validateOrganizationName: FieldValidator = ({ organizationName }) => {
  if (organizationName.trim().length > INTRO_CONTACT_FORM_LIMITS.organizationNameMax) {
    return `소속은 ${INTRO_CONTACT_FORM_LIMITS.organizationNameMax}자 이내로 입력해 주세요.`
  }
  return undefined
}

const validateEmail: FieldValidator = ({ email }) => {
  const trimmed = email.trim()
  if (!trimmed) return undefined
  if (trimmed.length > INTRO_CONTACT_FORM_LIMITS.emailMax) {
    return `이메일은 ${INTRO_CONTACT_FORM_LIMITS.emailMax}자 이내로 입력해 주세요.`
  }
  if (!EMAIL_PATTERN.test(trimmed)) return '이메일 형식을 확인해 주세요.'
  return undefined
}

const validateInquiryType: FieldValidator = ({ inquiryType }) =>
  inquiryType ? undefined : '문의 유형을 선택해 주세요.'

const validateMessage: FieldValidator = ({ message }) => {
  const trimmed = message.trim()
  const { messageMin, messageMax } = INTRO_CONTACT_FORM_LIMITS
  if (!trimmed) return '문의 내용을 입력해 주세요.'
  if (trimmed.length < messageMin) return `문의 내용을 ${messageMin}자 이상 입력해 주세요.`
  if (trimmed.length > messageMax) return `문의 내용은 ${messageMax}자 이내로 입력해 주세요.`
  return undefined
}

const validatePrivacyConsent: FieldValidator = ({ privacyConsent }) =>
  privacyConsent ? undefined : '개인정보 수집·이용에 동의해 주세요.'

const FIELD_VALIDATORS: ReadonlyArray<[IntroContactFormField, FieldValidator]> = [
  ['name', validateName],
  ['phone', validatePhone],
  ['organizationName', validateOrganizationName],
  ['email', validateEmail],
  ['inquiryType', validateInquiryType],
  ['message', validateMessage],
  ['privacyConsent', validatePrivacyConsent],
]

export function validateIntroContactForm(values: IntroContactFormValues): IntroContactFormErrors {
  const errors: IntroContactFormErrors = {}
  for (const [field, validate] of FIELD_VALIDATORS) {
    const error = validate(values)
    if (error) errors[field] = error
  }
  return errors
}

export function hasIntroContactFormErrors(errors: IntroContactFormErrors): boolean {
  return Object.keys(errors).length > 0
}

/** honeypot 이 채워졌다면 자동 제출로 간주한다. */
export function isIntroContactFormBot(values: IntroContactFormValues): boolean {
  return values.companyWebsite.trim().length > 0
}

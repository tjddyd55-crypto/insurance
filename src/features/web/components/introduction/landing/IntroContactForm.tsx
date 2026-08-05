import { useCallback, useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { FieldWrapper, FormButton, FormInput, FormSelect, FormTextarea } from '../../../../../components/form'
import {
  INTRO_CONTACT_TIMES,
  INTRO_INQUIRY_TYPES,
  INTRO_PHONE_DISPLAY,
} from '../../../config/introductionLandingContent'
import {
  hasIntroContactFormErrors,
  INTRO_CONTACT_FORM_INITIAL_VALUES,
  INTRO_CONTACT_FORM_LIMITS,
  isIntroContactFormBot,
  validateIntroContactForm,
  type IntroContactFormErrors,
  type IntroContactFormValues,
} from './introContactFormValidation'

/**
 * 도입 문의 폼 — 1단계(클라이언트 전용).
 *
 * 이 단계에서는 네트워크 호출을 하지 않는다. 검증까지만 수행하고,
 * 실제 접수 처리는 `onValidSubmit` 을 주입하는 상위(2단계 API 연동)가 담당한다.
 * 주입이 없으면 "접수됨" 이라고 말하지 않고 전화 안내만 노출한다.
 */

type SubmitStatus = 'idle' | 'invalid' | 'guided'

const PLACEHOLDER_INQUIRY_TYPE = '문의 유형을 선택해 주세요'
const PLACEHOLDER_CONTACT_TIME = '상담 가능 시간 선택 (선택)'
const GUIDED_MESSAGE = `문의 접수 기능은 곧 연결됩니다. 급한 문의는 전화 ${INTRO_PHONE_DISPLAY}로 연락해 주세요.`
const INVALID_MESSAGE = '입력하지 않았거나 형식이 맞지 않는 항목이 있습니다.'

const INQUIRY_TYPE_OPTIONS = [
  { value: '', label: PLACEHOLDER_INQUIRY_TYPE },
  ...INTRO_INQUIRY_TYPES,
]
const CONTACT_TIME_OPTIONS = [
  { value: '', label: PLACEHOLDER_CONTACT_TIME },
  ...INTRO_CONTACT_TIMES,
]

export type IntroContactFormProps = {
  /** 2단계 연동 지점. 검증을 통과한 값만 전달된다. */
  onValidSubmit?: (values: IntroContactFormValues) => void
  submitting?: boolean
}

export function IntroContactForm({ onValidSubmit, submitting = false }: IntroContactFormProps) {
  const fieldId = useId()
  const [values, setValues] = useState<IntroContactFormValues>(INTRO_CONTACT_FORM_INITIAL_VALUES)
  const [errors, setErrors] = useState<IntroContactFormErrors>({})
  const [status, setStatus] = useState<SubmitStatus>('idle')

  const updateField = useCallback(
    <Field extends keyof IntroContactFormValues>(field: Field, value: IntroContactFormValues[Field]) => {
      setValues((prev) => ({ ...prev, [field]: value }))
      setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
    },
    [],
  )

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      // 봇 제출은 오류를 노출하지 않고 조용히 무시한다.
      if (isIntroContactFormBot(values)) {
        setStatus('guided')
        return
      }

      const nextErrors = validateIntroContactForm(values)
      setErrors(nextErrors)
      if (hasIntroContactFormErrors(nextErrors)) {
        setStatus('invalid')
        return
      }

      setStatus('guided')
      onValidSubmit?.(values)
    },
    [values, onValidSubmit],
  )

  const statusMessage = status === 'invalid' ? INVALID_MESSAGE : status === 'guided' ? GUIDED_MESSAGE : ''

  return (
    <form className="intro-landing-form" noValidate onSubmit={handleSubmit}>
      <div className="intro-landing-form__grid">
        <FieldWrapper label="이름" required errorText={errors.name}>
          <FormInput
            name="name"
            value={values.name}
            maxLength={INTRO_CONTACT_FORM_LIMITS.nameMax}
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            onChange={(event) => updateField('name', event.target.value)}
          />
        </FieldWrapper>

        <FieldWrapper label="연락처" required errorText={errors.phone}>
          <FormInput
            name="phone"
            format="phone"
            value={values.phone}
            aria-invalid={Boolean(errors.phone)}
            onChange={(event) => updateField('phone', event.target.value)}
          />
        </FieldWrapper>

        <FieldWrapper label="소속 (GA·지점)" errorText={errors.organizationName}>
          <FormInput
            name="organizationName"
            value={values.organizationName}
            maxLength={INTRO_CONTACT_FORM_LIMITS.organizationNameMax}
            autoComplete="organization"
            aria-invalid={Boolean(errors.organizationName)}
            onChange={(event) => updateField('organizationName', event.target.value)}
          />
        </FieldWrapper>

        <FieldWrapper label="이메일" errorText={errors.email}>
          <FormInput
            name="email"
            type="email"
            value={values.email}
            maxLength={INTRO_CONTACT_FORM_LIMITS.emailMax}
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            onChange={(event) => updateField('email', event.target.value)}
          />
        </FieldWrapper>

        <FieldWrapper label="문의 유형" required errorText={errors.inquiryType}>
          <FormSelect
            name="inquiryType"
            value={values.inquiryType}
            options={INQUIRY_TYPE_OPTIONS}
            aria-invalid={Boolean(errors.inquiryType)}
            onChange={(event) =>
              updateField('inquiryType', event.target.value as IntroContactFormValues['inquiryType'])
            }
          />
        </FieldWrapper>

        <FieldWrapper label="연락 가능 시간" helperText="선택하지 않으면 평일 업무시간에 연락드립니다.">
          <FormSelect
            name="preferredContactTime"
            value={values.preferredContactTime}
            options={CONTACT_TIME_OPTIONS}
            onChange={(event) =>
              updateField(
                'preferredContactTime',
                event.target.value as IntroContactFormValues['preferredContactTime'],
              )
            }
          />
        </FieldWrapper>
      </div>

      <FieldWrapper
        label="문의 내용"
        required
        className="intro-landing-form__message"
        errorText={errors.message}
        helperText={`${INTRO_CONTACT_FORM_LIMITS.messageMin}자 이상 ${INTRO_CONTACT_FORM_LIMITS.messageMax}자 이내로 작성해 주세요.`}
      >
        <FormTextarea
          name="message"
          rows={5}
          value={values.message}
          maxLength={INTRO_CONTACT_FORM_LIMITS.messageMax}
          aria-invalid={Boolean(errors.message)}
          onChange={(event) => updateField('message', event.target.value)}
        />
      </FieldWrapper>

      {/* honeypot — 사람에게 보이지 않는다. 값이 채워지면 봇 제출로 판단한다. */}
      <FormInput
        type="text"
        name="company_website"
        className="intro-landing-form__honeypot"
        value={values.companyWebsite}
        onChange={(event) => updateField('companyWebsite', event.target.value)}
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className="intro-landing-form__consent">
        <label className="intro-landing-form__consent-label" htmlFor={`${fieldId}-privacy`}>
          <FormInput
            id={`${fieldId}-privacy`}
            type="checkbox"
            name="privacyConsent"
            checked={values.privacyConsent}
            aria-invalid={Boolean(errors.privacyConsent)}
            onChange={(event) => updateField('privacyConsent', event.target.checked)}
          />
          <span>
            <Link to="/privacy" className="intro-landing-form__consent-link">
              개인정보 처리방침
            </Link>
            에 따른 개인정보 수집·이용에 동의합니다. (필수)
          </span>
        </label>
        {errors.privacyConsent ? (
          <p className="intro-landing-form__error">{errors.privacyConsent}</p>
        ) : null}
      </div>

      <div className="intro-landing-form__footer">
        <FormButton htmlType="submit" variant="primary" loading={submitting} fullWidth>
          문의 남기기
        </FormButton>
        <p className="intro-landing-form__status" role="status" aria-live="polite">
          {statusMessage}
        </p>
      </div>
    </form>
  )
}

export default IntroContactForm

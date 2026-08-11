import { useEffect, useRef, useState } from 'react'
import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
import { copyTextToClipboard } from '../../../lib/clipboard'
import { CUSTOMER_ACCOUNT_NUMBER_PLACEHOLDER } from '../utils/customerDisplayFormat'

const COPY_FEEDBACK_MS = 1500

type CustomerCopyButtonProps = {
  /** 복사 대상 텍스트 (계좌번호 값만) */
  text: string
  disabled?: boolean
  label?: string
  ariaLabel?: string
}

/**
 * 텍스트 한 건을 클립보드로 복사하고 짧은 성공 피드백을 보여주는 버튼.
 * 복사 로직/피드백을 한 곳에 모아 등록·수정·상세 화면이 동일하게 재사용한다.
 */
export function CustomerCopyButton({ text, disabled, label = '복사', ariaLabel }: CustomerCopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const trimmed = text.trim()

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    },
    [],
  )

  const handleCopy = async () => {
    if (!trimmed) {
      return
    }
    const ok = await copyTextToClipboard(trimmed)
    if (!ok) {
      return
    }
    setCopied(true)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }

  return (
    <span className="customer-account-number__copy-wrap">
      <FormButton
        htmlType="button"
        variant="secondary"
        size="sm"
        className="customer-account-number__copy"
        disabled={disabled || !trimmed}
        aria-label={ariaLabel}
        onClick={() => void handleCopy()}
      >
        {label}
      </FormButton>
      <span className="customer-account-number__feedback" role="status" aria-live="polite">
        {copied ? '복사되었습니다.' : ''}
      </span>
    </span>
  )
}

type CustomerAccountNumberFieldProps = {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  /** 같은 화면에서 여러 번 렌더될 때 id 충돌 방지용 접미사 */
  idSuffix?: string
}

/**
 * 등록·수정 폼용 계좌번호 입력 필드 + 복사 버튼.
 * 숫자 강제 없이 자유 텍스트로 입력받으며, 값이 없으면 복사 버튼이 비활성화된다.
 */
export function CustomerAccountNumberField({
  value,
  onChange,
  disabled,
  idSuffix,
}: CustomerAccountNumberFieldProps) {
  const inputId = `customer-account-number${idSuffix ? `-${idSuffix}` : ''}`
  return (
    <div className="customer-account-number">
      <div className="customer-account-number__row">
        <FormInput
          id={inputId}
          className="field__control customer-account-number__input"
          value={value}
          disabled={disabled}
          placeholder={CUSTOMER_ACCOUNT_NUMBER_PLACEHOLDER}
          aria-label="계좌번호"
          onChange={(e) => onChange(e.target.value)}
        />
        <CustomerCopyButton text={value} disabled={disabled} ariaLabel="계좌번호 복사" />
      </div>
    </div>
  )
}

export default CustomerAccountNumberField

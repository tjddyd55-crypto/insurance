import type { MouseEvent } from 'react'

export type CustomerContactActionsProps = {
  phone: string
  /** true면 문자 액션 비활성(수신 거부) */
  smsDisabled?: boolean
  className?: string
  /** 카드 요약 행 vs 상세 헤더 — 동일 visual, spacing만 미세 조정 */
  variant?: 'card' | 'inline'
  onClickStopPropagation?: boolean
}

function customerPhoneHref(phone: string, scheme: 'tel' | 'sms'): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length < 8) {
    return null
  }
  return `${scheme}:${digits}`
}

function ContactPhoneIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="customer-contact-actions__icon"
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function ContactMessageIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="customer-contact-actions__icon"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export function CustomerContactActions({
  phone,
  smsDisabled = false,
  className,
  variant = 'card',
  onClickStopPropagation = true,
}: CustomerContactActionsProps) {
  const telHref = customerPhoneHref(phone, 'tel')
  const smsHref = smsDisabled ? null : customerPhoneHref(phone, 'sms')

  const stop = (e: MouseEvent) => {
    if (onClickStopPropagation) {
      e.stopPropagation()
    }
  }

  return (
    <div
      className={`customer-contact-actions customer-contact-actions--${variant}${className ? ` ${className}` : ''}`}
      role="presentation"
      onClick={stop}
      onKeyDown={stop}
    >
      {smsHref ? (
        <a
          href={smsHref}
          className="customer-contact-actions__plate customer-contact-actions__plate--sms"
          aria-label="문자 보내기"
          onClick={stop}
        >
          <ContactMessageIcon />
        </a>
      ) : (
        <span
          className="customer-contact-actions__plate customer-contact-actions__plate--sms customer-contact-actions__plate--disabled"
          aria-hidden
        >
          <ContactMessageIcon />
        </span>
      )}
      {telHref ? (
        <a
          href={telHref}
          className="customer-contact-actions__plate customer-contact-actions__plate--tel"
          aria-label="전화 걸기"
          onClick={stop}
        >
          <ContactPhoneIcon />
        </a>
      ) : (
        <span
          className="customer-contact-actions__plate customer-contact-actions__plate--tel customer-contact-actions__plate--disabled"
          aria-hidden
        >
          <ContactPhoneIcon />
        </span>
      )}
    </div>
  )
}

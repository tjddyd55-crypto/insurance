import { useState } from 'react'
import {
  MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_BODY,
  MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_TITLE,
} from '../consultation/consultationPrivacyPolicy'

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function AdvisorConsultationPrivacyConsent({ checked, onChange, disabled }: Props) {
  const [termsOpen, setTermsOpen] = useState(false)

  return (
    <>
      <label className="pap-consult-privacy">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="pap-consult-privacy__label">
          개인정보 수집·이용 동의 <span className="pap-consult-privacy__required">(필수)</span>
        </span>
        <button
          type="button"
          className="pap-consult-privacy__link"
          onClick={(e) => {
            e.preventDefault()
            setTermsOpen(true)
          }}
        >
          내용보기
        </button>
      </label>

      {termsOpen ? (
        <div className="pap-modal-backdrop" role="presentation" onClick={() => setTermsOpen(false)}>
          <div
            className="pap-modal pap-modal--sheet pap-consult-privacy-modal"
            role="dialog"
            aria-labelledby="consult-privacy-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="consult-privacy-title">{MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_TITLE}</h2>
            <div className="pap-consult-privacy-modal__body">{MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_BODY}</div>
            <div className="pap-cta-row">
              <button type="button" className="pap-btn pap-btn--primary" onClick={() => setTermsOpen(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

import { useEffect, useRef } from 'react'
import { useBackButtonClose } from '../../../hooks/useBackButtonClose'
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock'
import {
  MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_BODY,
  MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_TITLE,
} from '../consultation/consultationPrivacyPolicy'

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  termsOpen: boolean
  onTermsOpenChange: (open: boolean) => void
}

export function AdvisorConsultationPrivacyConsent({
  checked,
  onChange,
  disabled,
  termsOpen,
  onTermsOpenChange,
}: Props) {
  const viewLinkRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useBackButtonClose(termsOpen, () => onTermsOpenChange(false), { layerKind: 'pap-privacy-modal' })
  useBodyScrollLock(termsOpen, { lockDocumentElement: true })

  useEffect(() => {
    if (!termsOpen) return
    const t = window.setTimeout(() => {
      dialogRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(t)
  }, [termsOpen])

  useEffect(() => {
    if (!termsOpen) return undefined

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onTermsOpenChange(false)
      window.requestAnimationFrame(() => viewLinkRef.current?.focus())
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [termsOpen, onTermsOpenChange])

  const closeTerms = () => {
    onTermsOpenChange(false)
    window.requestAnimationFrame(() => viewLinkRef.current?.focus())
  }

  const confirmTerms = () => {
    onChange(true)
    onTermsOpenChange(false)
    window.requestAnimationFrame(() => viewLinkRef.current?.focus())
  }

  return (
    <>
      <div className="pap-consult-privacy">
        <label className="pap-consult-privacy__check">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="pap-consult-privacy__label">
            개인정보 수집·이용 동의 <span className="pap-consult-privacy__required">(필수)</span>
          </span>
        </label>
        <button
          ref={viewLinkRef}
          type="button"
          className="pap-consult-privacy__link"
          disabled={disabled}
          onClick={(e) => {
            e.preventDefault()
            onTermsOpenChange(true)
          }}
        >
          내용보기
        </button>
      </div>

      {termsOpen ? (
        <div
          className="pap-modal-backdrop pap-modal-backdrop--privacy"
          role="presentation"
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div
            ref={dialogRef}
            className="pap-modal pap-modal--sheet pap-consult-privacy-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="consult-privacy-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="pap-modal__header">
              <h2 id="consult-privacy-title">{MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_TITLE}</h2>
            </header>
            <div className="pap-consult-privacy-modal__body">{MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_BODY}</div>
            <footer className="pap-modal__footer pap-cta-row">
              <button type="button" className="pap-btn pap-btn--secondary" onClick={closeTerms}>
                취소
              </button>
              <button type="button" className="pap-btn pap-btn--primary" onClick={confirmTerms}>
                확인
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  )
}

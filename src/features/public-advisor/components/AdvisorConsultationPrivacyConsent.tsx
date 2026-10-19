import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { useBackButtonClose } from '../../../hooks/useBackButtonClose'
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock'
import {
  MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_BODY,
  MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_TITLE,
} from '../consultation/consultationPrivacyPolicy'
import {
  consultSheetStyle,
  useVisualViewportKeyboardState,
  type VisualViewportKeyboardState,
} from '../hooks/useVisualViewportKeyboardState'

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  error?: string
  termsOpen: boolean
  onTermsOpenChange: (open: boolean) => void
}

export function AdvisorConsultationPrivacyConsent({
  checked,
  onChange,
  disabled,
  error,
  termsOpen,
  onTermsOpenChange,
}: Props) {
  const viewLinkRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const keyboard = useVisualViewportKeyboardState(termsOpen)

  const closeTerms = useCallback(() => {
    onTermsOpenChange(false)
    window.requestAnimationFrame(() => viewLinkRef.current?.focus())
  }, [onTermsOpenChange])

  const confirmTerms = useCallback(() => {
    onChange(true)
    onTermsOpenChange(false)
    window.requestAnimationFrame(() => viewLinkRef.current?.focus())
  }, [onChange, onTermsOpenChange])

  useBackButtonClose(termsOpen, closeTerms, { layerKind: 'pap-privacy-modal' })
  useBodyScrollLock(termsOpen, { lockDocumentElement: true })

  useEffect(() => {
    if (!termsOpen) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      closeTerms()
    }
    window.addEventListener('keydown', onKeyDown, true)
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.clearTimeout(focusTimer)
    }
  }, [termsOpen, closeTerms])

  const footer = (
    <footer className="pap-consult-footer">
      <button type="button" className="pap-btn pap-btn--secondary" onClick={closeTerms}>
        취소
      </button>
      <button type="button" className="pap-btn pap-btn--primary" onClick={confirmTerms}>
        확인
      </button>
    </footer>
  )

  return (
    <>
      <div className="pap-consult-privacy-block">
        <PrivacyConsentRow
          checked={checked}
          disabled={disabled}
          onChecked={onChange}
          onOpenTerms={() => onTermsOpenChange(true)}
          viewLinkRef={viewLinkRef}
        />
        {error ? (
          <p id="pap-consult-privacy-error" className="pap-field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      {termsOpen ? (
        <PrivacySheet
          dialogRef={dialogRef}
          keyboard={keyboard}
          footer={footer}
          keyboardOpen={keyboard.keyboardOpen}
        />
      ) : null}
    </>
  )
}

function PrivacyConsentRow({
  checked,
  disabled,
  onChecked,
  onOpenTerms,
  viewLinkRef,
}: {
  checked: boolean
  disabled?: boolean
  onChecked: (checked: boolean) => void
  onOpenTerms: () => void
  viewLinkRef: RefObject<HTMLButtonElement | null>
}) {
  return (
    <div className="pap-consult-privacy">
      <label className="pap-consult-privacy__check">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChecked(e.target.checked)} />
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
          onOpenTerms()
        }}
      >
        내용보기
      </button>
    </div>
  )
}

function PrivacySheet({
  dialogRef,
  keyboard,
  footer,
  keyboardOpen,
}: {
  dialogRef: RefObject<HTMLDivElement | null>
  keyboard: VisualViewportKeyboardState
  footer: ReactNode
  keyboardOpen: boolean
}) {
  return (
    <div className="pap-modal-backdrop pap-modal-backdrop--privacy" role="presentation">
      <div
        ref={dialogRef}
        className="pap-modal pap-modal--sheet pap-consult-privacy-modal"
        style={consultSheetStyle(keyboard)}
        data-keyboard={keyboardOpen ? 'open' : 'closed'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consult-privacy-title"
        tabIndex={-1}
      >
        <header className="pap-modal__header">
          <h2 id="consult-privacy-title">{MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_TITLE}</h2>
        </header>
        <div className="pap-modal__body">
          <div className="pap-consult-privacy-modal__copy">{MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_BODY}</div>
          {keyboardOpen ? footer : null}
        </div>
        {keyboardOpen ? null : footer}
      </div>
    </div>
  )
}

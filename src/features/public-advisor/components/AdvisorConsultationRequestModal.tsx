import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import { useBackButtonClose } from '../../../hooks/useBackButtonClose'
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock'
import {
  ensureFocusedFieldVisible,
  focusedFieldUsableBottom,
  FOCUSED_FIELD_PADDING_PX,
} from '../hooks/consultModalKeyboardScroll'
import {
  consultSheetStyle,
  readVisualViewportKeyboardState,
  useVisualViewportKeyboardState,
} from '../hooks/useVisualViewportKeyboardState'
import { formatKrPhoneInputLive } from '../utils/formatKrPhoneNumber'
import {
  isConsultDraftValid,
  visibleConsultFieldErrors,
  type ConsultContactChannel,
  type ConsultSubmitError,
} from '../utils/consultFormValidation'
import { AdvisorConsultationPrivacyConsent } from './AdvisorConsultationPrivacyConsent'

type Props = {
  open: boolean
  submitting: boolean
  submitError?: ConsultSubmitError | null
  onClose: () => void
  onSubmitErrorClear?: () => void
  onSubmit: (payload: {
    name: string
    phone: string
    message: string
    contactChannel: ConsultContactChannel
    privacyConsent: boolean
  }) => void | Promise<void>
}

type FooterProps = {
  submitting: boolean
  submitEnabled: boolean
  submitError?: ConsultSubmitError | null
  onClose: () => void
}

function ConsultFooter({ submitting, submitEnabled, submitError, onClose }: FooterProps) {
  const submitDisabled = submitting || !submitEnabled
  return (
    <>
      {submitError?.kind === 'system' ? (
        <p className="pap-consult-alert pap-consult-alert--system" role="alert">
          {submitError.message}
        </p>
      ) : null}
      <footer className="pap-consult-footer">
        {submitError?.kind === 'business' ? (
          <p className="pap-consult-alert pap-consult-alert--business" role="alert">
            {submitError.message}
          </p>
        ) : null}
        <button type="button" className="pap-btn pap-btn--secondary" onClick={onClose} disabled={submitting}>
          닫기
        </button>
        <button type="submit" className="pap-btn pap-btn--primary" disabled={submitDisabled} aria-disabled={submitDisabled}>
          {submitting ? '전송 중…' : '신청하기'}
        </button>
      </footer>
    </>
  )
}

function scrollFocusedField(scrollRoot: HTMLElement, field: HTMLElement, footerTop: number | null) {
  const keyboard = readVisualViewportKeyboardState()
  const vv = window.visualViewport
  const visibleTop = (vv?.offsetTop ?? 0) + FOCUSED_FIELD_PADDING_PX
  const visibleBottom = focusedFieldUsableBottom({
    viewportOffsetTop: keyboard.viewportOffsetTop,
    viewportHeight: keyboard.viewportHeight,
    keyboardOpen: keyboard.keyboardOpen,
    footerTop,
  })
  ensureFocusedFieldVisible(scrollRoot, field, { visibleTop, visibleBottom })
}

export function AdvisorConsultationRequestModal({
  open,
  submitting,
  submitError = null,
  onClose,
  onSubmitErrorClear,
  onSubmit,
}: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [contactChannel, setContactChannel] = useState<ConsultContactChannel>('phone')
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [privacyTermsOpen, setPrivacyTermsOpen] = useState(false)
  const [trackedOpen, setTrackedOpen] = useState(open)
  const scrollBodyRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const keyboard = useVisualViewportKeyboardState(open)

  if (open !== trackedOpen) {
    setTrackedOpen(open)
    if (!open) {
      setPrivacyTermsOpen(false)
      setName('')
      setPhone('')
      setMessage('')
      setContactChannel('phone')
      setPrivacyConsent(false)
    }
  }

  useBackButtonClose(open, onClose, { layerKind: 'pap-consult-modal' })
  useBodyScrollLock(open, { lockDocumentElement: true })

  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || privacyTermsOpen) return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, privacyTermsOpen])

  useEffect(() => {
    const root = scrollBodyRef.current
    if (!open || !root) return undefined

    const runAdjust = (target: HTMLElement) => {
      const footer = formRef.current?.querySelector('.pap-consult-footer')
      const footerTop = footer instanceof HTMLElement ? footer.getBoundingClientRect().top : null
      scrollFocusedField(root, target, footerTop)
    }

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target
      if (!(target instanceof HTMLElement) || !target.matches('input, textarea, select')) return
      window.requestAnimationFrame(() => {
        runAdjust(target)
        window.requestAnimationFrame(() => runAdjust(target))
      })
    }

    root.addEventListener('focusin', onFocusIn)
    return () => root.removeEventListener('focusin', onFocusIn)
  }, [open])

  useEffect(() => {
    if (!open) return
    const active = document.activeElement
    const root = scrollBodyRef.current
    if (!(active instanceof HTMLElement) || !root?.contains(active)) return
    if (!active.matches('input, textarea, select')) return
    const footer = formRef.current?.querySelector('.pap-consult-footer')
    const footerTop = footer instanceof HTMLElement ? footer.getBoundingClientRect().top : null
    scrollFocusedField(root, active, footerTop)
  }, [open, keyboard.keyboardOpen, keyboard.viewportHeight, keyboard.viewportOffsetTop])

  if (!open) return null

  const draft = { name, phone, message, contactChannel, privacyConsent }
  const fieldErrors = visibleConsultFieldErrors(draft)
  const submitEnabled = isConsultDraftValid(draft)

  const noteChange = () => {
    if (submitError) onSubmitErrorClear?.()
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!submitEnabled || submitting) return
    void onSubmit({
      name: name.trim(),
      phone,
      message: message.trim(),
      contactChannel,
      privacyConsent: true,
    })
  }

  const footer = (
    <ConsultFooter
      submitting={submitting}
      submitEnabled={submitEnabled}
      submitError={submitError}
      onClose={onClose}
    />
  )

  return (
    <div className="pap-modal-backdrop pap-modal-backdrop--consult" role="presentation">
      <form
        ref={formRef}
        className="pap-modal pap-modal--sheet pap-modal--consult"
        style={consultSheetStyle(keyboard)}
        data-keyboard={keyboard.keyboardOpen ? 'open' : 'closed'}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pap-consult-modal-title"
      >
        <header className="pap-modal__header">
          <h2 id="pap-consult-modal-title">상담 신청</h2>
          <p className="pap-affiliation">입력한 정보가 상담을 위해 해당 설계사에게 전달됩니다.</p>
        </header>
        <ConsultBody scrollRef={scrollBodyRef} footer={keyboard.keyboardOpen ? footer : null}>
          <label>
            이름
            <input
              name="name"
              value={name}
              disabled={submitting}
              autoComplete="name"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'pap-consult-name-error' : undefined}
              onChange={(e) => {
                setName(e.target.value)
                noteChange()
              }}
            />
            {fieldErrors.name ? (
              <p id="pap-consult-name-error" className="pap-field-error" role="alert">
                {fieldErrors.name}
              </p>
            ) : null}
          </label>
          <label>
            연락처
            <input
              name="phone"
              placeholder="010-1234-5678"
              value={phone}
              disabled={submitting}
              autoComplete="tel"
              inputMode="tel"
              aria-invalid={Boolean(fieldErrors.phone)}
              aria-describedby={fieldErrors.phone ? 'pap-consult-phone-error' : undefined}
              onChange={(e) => {
                setPhone(formatKrPhoneInputLive(e.target.value))
                noteChange()
              }}
            />
            {fieldErrors.phone ? (
              <p id="pap-consult-phone-error" className="pap-field-error" role="alert">
                {fieldErrors.phone}
              </p>
            ) : null}
          </label>
          <label>
            문의 내용
            <textarea
              name="message"
              value={message}
              disabled={submitting}
              rows={4}
              aria-invalid={Boolean(fieldErrors.message)}
              aria-describedby={fieldErrors.message ? 'pap-consult-message-error' : undefined}
              onChange={(e) => {
                setMessage(e.target.value)
                noteChange()
              }}
            />
            {fieldErrors.message ? (
              <p id="pap-consult-message-error" className="pap-field-error" role="alert">
                {fieldErrors.message}
              </p>
            ) : null}
          </label>
          <label>
            연락 희망 방식
            <select
              name="contactChannel"
              value={contactChannel}
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.contactChannel)}
              onChange={(e) => {
                setContactChannel(e.target.value as ConsultContactChannel)
                noteChange()
              }}
            >
              <option value="phone">전화</option>
              <option value="sms">문자</option>
              <option value="kakao">카카오톡</option>
            </select>
            {fieldErrors.contactChannel ? (
              <p className="pap-field-error" role="alert">
                {fieldErrors.contactChannel}
              </p>
            ) : null}
          </label>
          <AdvisorConsultationPrivacyConsent
            checked={privacyConsent}
            onChange={(checked) => {
              setPrivacyConsent(checked)
              noteChange()
            }}
            disabled={submitting}
            error={fieldErrors.privacy}
            termsOpen={privacyTermsOpen}
            onTermsOpenChange={setPrivacyTermsOpen}
          />
        </ConsultBody>
        {keyboard.keyboardOpen ? null : footer}
      </form>
    </div>
  )
}

function ConsultBody({
  scrollRef,
  footer,
  children,
}: {
  scrollRef: RefObject<HTMLDivElement | null>
  footer: ReactNode
  children: ReactNode
}) {
  return (
    <div className="pap-modal__body" ref={scrollRef}>
      <div className="pap-sheet__fields">{children}</div>
      {footer}
    </div>
  )
}

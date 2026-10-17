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
import { AdvisorConsultationPrivacyConsent } from './AdvisorConsultationPrivacyConsent'

type Props = {
  open: boolean
  submitting: boolean
  onClose: () => void
  onSubmit: (payload: {
    name: string
    phone: string
    message: string
    contactChannel: 'phone' | 'sms' | 'kakao'
    privacyConsent: boolean
  }) => void | Promise<void>
}

type FooterProps = {
  submitting: boolean
  privacyConsent: boolean
  onClose: () => void
}

function ConsultFooter({ submitting, privacyConsent, onClose }: FooterProps) {
  const submitDisabled = submitting || !privacyConsent
  return (
    <footer className="pap-consult-footer">
      <button type="button" className="pap-btn pap-btn--secondary" onClick={onClose} disabled={submitting}>
        닫기
      </button>
      <button type="submit" className="pap-btn pap-btn--primary" disabled={submitDisabled} aria-disabled={submitDisabled}>
        {submitting ? '전송 중…' : '신청하기'}
      </button>
    </footer>
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

export function AdvisorConsultationRequestModal({ open, submitting, onClose, onSubmit }: Props) {
  const [phone, setPhone] = useState('')
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [privacyTermsOpen, setPrivacyTermsOpen] = useState(false)
  const [trackedOpen, setTrackedOpen] = useState(open)
  const scrollBodyRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const keyboard = useVisualViewportKeyboardState(open)

  if (open !== trackedOpen) {
    setTrackedOpen(open)
    if (!open) setPrivacyTermsOpen(false)
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

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!privacyConsent || submitting) return
    const form = new FormData(e.currentTarget)
    void onSubmit({
      name: String(form.get('name') ?? ''),
      phone,
      message: String(form.get('message') ?? ''),
      contactChannel: String(form.get('contactChannel') ?? 'phone') as 'phone' | 'sms' | 'kakao',
      privacyConsent: true,
    })
  }

  const footer = (
    <ConsultFooter submitting={submitting} privacyConsent={privacyConsent} onClose={onClose} />
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
            <input name="name" required minLength={2} disabled={submitting} autoComplete="name" />
          </label>
          <label>
            연락처
            <input
              name="phone"
              required
              placeholder="010-1234-5678"
              value={phone}
              disabled={submitting}
              autoComplete="tel"
              onChange={(e) => setPhone(formatKrPhoneInputLive(e.target.value))}
            />
          </label>
          <label>
            문의 내용
            <textarea name="message" required minLength={5} disabled={submitting} rows={4} />
          </label>
          <label>
            연락 희망 방식
            <select name="contactChannel" defaultValue="phone" disabled={submitting}>
              <option value="phone">전화</option>
              <option value="sms">문자</option>
              <option value="kakao">카카오톡</option>
            </select>
          </label>
          <AdvisorConsultationPrivacyConsent
            checked={privacyConsent}
            onChange={setPrivacyConsent}
            disabled={submitting}
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

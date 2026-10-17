import { FormEvent, useEffect, useRef, useState } from 'react'
import { useBackButtonClose } from '../../../hooks/useBackButtonClose'
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock'
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

export function AdvisorConsultationRequestModal({ open, submitting, onClose, onSubmit }: Props) {
  const [phone, setPhone] = useState('')
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [privacyTermsOpen, setPrivacyTermsOpen] = useState(false)
  const scrollBodyRef = useRef<HTMLDivElement>(null)
  useBackButtonClose(open && !privacyTermsOpen, onClose, { layerKind: 'pap-consult-modal' })
  useBodyScrollLock(open, { lockDocumentElement: true })

  useEffect(() => {
    if (!open) {
      setPrivacyTermsOpen(false)
    }
  }, [open])

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
    if (!open || typeof window === 'undefined') return undefined
    const vv = window.visualViewport
    if (!vv) return undefined

    const apply = () => {
      document.documentElement.style.setProperty('--pap-modal-vh', `${Math.round(vv.height)}px`)
    }
    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      document.documentElement.style.removeProperty('--pap-modal-vh')
    }
  }, [open])

  useEffect(() => {
    const root = scrollBodyRef.current
    if (!open || !root) return undefined

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target
      if (!(target instanceof HTMLElement)) return
      if (!target.matches('input, textarea, select')) return
      window.requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      })
    }
    root.addEventListener('focusin', onFocusIn)
    return () => root.removeEventListener('focusin', onFocusIn)
  }, [open])

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

  return (
    <div className="pap-modal-backdrop pap-modal-backdrop--consult" role="presentation">
      <form
        className="pap-modal pap-modal--sheet pap-modal--consult"
        onSubmit={handleSubmit}
        aria-labelledby="pap-consult-modal-title"
      >
        <header className="pap-modal__header">
          <h2 id="pap-consult-modal-title">상담 신청</h2>
          <p className="pap-affiliation">입력한 정보가 상담을 위해 해당 설계사에게 전달됩니다.</p>
        </header>

        <div className="pap-modal__body" ref={scrollBodyRef}>
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
        </div>

        <footer className="pap-modal__footer pap-cta-row">
          <button type="button" className="pap-btn pap-btn--secondary" onClick={onClose} disabled={submitting}>
            닫기
          </button>
          <button type="submit" className="pap-btn pap-btn--primary" disabled={submitting || !privacyConsent}>
            {submitting ? '전송 중…' : '신청하기'}
          </button>
        </footer>
      </form>
    </div>
  )
}

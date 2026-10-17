import { FormEvent, useState } from 'react'
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
    <div className="pap-modal-backdrop">
      <form className="pap-modal pap-modal--sheet" onSubmit={handleSubmit}>
        <h2>상담 신청</h2>
        <p className="pap-affiliation">입력한 정보가 상담을 위해 해당 설계사에게 전달됩니다.</p>
        <label>
          이름
          <input name="name" required minLength={2} disabled={submitting} />
        </label>
        <label>
          연락처
          <input
            name="phone"
            required
            placeholder="010-1234-5678"
            value={phone}
            disabled={submitting}
            onChange={(e) => setPhone(formatKrPhoneInputLive(e.target.value))}
          />
        </label>
        <label>
          문의 내용
          <textarea name="message" required minLength={5} disabled={submitting} />
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
        />
        <div className="pap-cta-row">
          <button type="button" className="pap-btn pap-btn--secondary" onClick={onClose} disabled={submitting}>
            닫기
          </button>
          <button type="submit" className="pap-btn pap-btn--primary" disabled={submitting || !privacyConsent}>
            {submitting ? '전송 중…' : '신청하기'}
          </button>
        </div>
      </form>
    </div>
  )
}

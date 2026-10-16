import { FormEvent, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  fetchPublicAdvisorBySlug,
  submitAdvisorConsultation,
  type PublicAdvisorDetail,
} from '../api/publicAdvisorApi'
import '../public-advisor.css'

export function PublicAdvisorProfilePage() {
  const { slug = '' } = useParams()
  const [data, setData] = useState<PublicAdvisorDetail | null>(null)
  const [error, setError] = useState('')
  const [consultOpen, setConsultOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchPublicAdvisorBySlug(slug)
      .then((row) => {
        if (!cancelled) {
          setData(row)
          document.title = `${row.displayName} | ONE FC 설계사`
          const desc = row.headline || row.bio?.slice(0, 120) || ''
          let meta = document.querySelector('meta[name="description"]')
          if (!meta) {
            meta = document.createElement('meta')
            meta.setAttribute('name', 'description')
            document.head.appendChild(meta)
          }
          meta.setAttribute('content', desc)
        }
      })
      .catch(() => {
        if (!cancelled) setError('프로필을 찾을 수 없습니다.')
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const onConsultSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!data) return
    const form = new FormData(e.currentTarget)
    setSubmitting(true)
    try {
      await submitAdvisorConsultation(slug, {
        name: String(form.get('name') ?? ''),
        phone: String(form.get('phone') ?? ''),
        message: String(form.get('message') ?? ''),
        contactChannel: String(form.get('contactChannel') ?? 'phone') as 'phone' | 'sms' | 'kakao',
        privacyConsent: form.get('privacyConsent') === 'on',
      })
      setSubmitDone(true)
      setConsultOpen(false)
    } catch {
      setError('상담 신청에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  if (error && !data) {
    return (
      <div className="public-advisor-page">
        <div className="public-advisor-shell"><p>{error}</p></div>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="public-advisor-page">
        <div className="public-advisor-shell"><p>불러오는 중…</p></div>
      </div>
    )
  }

  const affiliation = [data.gaName, data.teamName].filter(Boolean).join(' ')
  const titleSuffix = data.titleLabel?.trim() || 'FC'

  return (
    <div className="public-advisor-page">
      <div className="public-advisor-shell">
        <header className="pap-hero">
          {data.profilePhotoUrl ? (
            <img className="pap-avatar" src={data.profilePhotoUrl} alt={data.displayName} />
          ) : (
            <div className="pap-avatar" aria-hidden />
          )}
          <h1 className="pap-name">{data.displayName} {titleSuffix}</h1>
          {affiliation ? <p className="pap-affiliation">{affiliation}</p> : null}
          {data.officeLine ? <p className="pap-affiliation">{data.officeLine}</p> : null}
          {data.hashtags?.length ? (
            <div className="pap-tags">
              {data.hashtags.map((tag) => (
                <span key={tag} className="pap-tag">#{tag}</span>
              ))}
            </div>
          ) : null}
          {data.headline ? <p className="pap-headline">{data.headline}</p> : null}
          <div className="pap-cta-row">
            {data.phoneNumber ? (
              <a className="pap-btn pap-btn--primary" href={`tel:${data.phoneNumber.replace(/\s/g, '')}`}>
                전화
              </a>
            ) : null}
            {data.kakaoLink ? (
              <a className="pap-btn pap-btn--secondary" href={data.kakaoLink} target="_blank" rel="noopener noreferrer">
                카카오톡
              </a>
            ) : null}
            {data.allowConsultation ? (
              <button type="button" className="pap-btn pap-btn--secondary" onClick={() => setConsultOpen(true)}>
                상담신청
              </button>
            ) : null}
          </div>
        </header>

        {data.verificationBadges?.length ? (
          <div className="pap-tags">
            {data.verificationBadges.map((b) => (
              <span key={b.id} className="pap-tag">{b.label}</span>
            ))}
          </div>
        ) : null}

        {data.bio ? (
          <section className="pap-section">
            <h2>자기소개</h2>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{data.bio}</p>
          </section>
        ) : null}

        {data.gallery?.length ? (
          <section className="pap-section">
            <h2>사진/활동</h2>
            <div className="pap-gallery">
              {data.gallery.map((g) => (
                <figure key={g.id}>
                  {g.imageUrl ? <img src={g.imageUrl} alt={g.caption || ''} /> : null}
                  {g.caption ? <figcaption>{g.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        {data.careerText ? (
          <section className="pap-section">
            <h2>경력/소속</h2>
            <p style={{ whiteSpace: 'pre-wrap' }}>{data.careerText}</p>
          </section>
        ) : null}

        {submitDone ? <p role="status">상담 신청이 접수되었습니다.</p> : null}
      </div>

      {(data.phoneNumber || data.allowConsultation) ? (
        <div className="pap-sticky-cta">
          {data.phoneNumber ? (
            <a className="pap-btn pap-btn--primary" href={`tel:${data.phoneNumber.replace(/\s/g, '')}`}>전화</a>
          ) : null}
          {data.allowConsultation ? (
            <button type="button" className="pap-btn pap-btn--secondary" onClick={() => setConsultOpen(true)}>
              상담신청
            </button>
          ) : null}
        </div>
      ) : null}

      {consultOpen ? (
        <div className="pap-section" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
          <form
            className="public-advisor-shell"
            style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxHeight: '90vh', overflow: 'auto' }}
            onSubmit={(e) => void onConsultSubmit(e)}
          >
            <h2>상담 신청</h2>
            <p>입력한 정보가 상담을 위해 해당 설계사에게 전달됩니다.</p>
            <label>이름<input name="name" required minLength={2} /></label>
            <label>연락처<input name="phone" required placeholder="010-1234-5678" /></label>
            <label>문의 내용<textarea name="message" required minLength={5} /></label>
            <label>
              연락 희망 방식
              <select name="contactChannel" defaultValue="phone">
                <option value="phone">전화</option>
                <option value="sms">문자</option>
                <option value="kakao">카카오톡</option>
              </select>
            </label>
            <label>
              <input type="checkbox" name="privacyConsent" required /> 개인정보 제공에 동의합니다.
            </label>
            <div className="pap-cta-row">
              <button type="button" className="pap-btn pap-btn--secondary" onClick={() => setConsultOpen(false)}>닫기</button>
              <button type="submit" className="pap-btn pap-btn--primary" disabled={submitting}>
                {submitting ? '전송 중…' : '신청하기'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

export default PublicAdvisorProfilePage

import { FormEvent, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ADVISOR_PUBLIC_EVENT,
  fetchPublicAdvisorBySlug,
  submitAdvisorConsultation,
  trackAdvisorPublicEvent,
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchPublicAdvisorBySlug(slug)
      .then((row) => {
        if (!cancelled) {
          setData(row)
          document.title = `${row.displayName} | ONE FC`
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
    if (!data || submitting) return
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

  const openConsult = () => {
    trackAdvisorPublicEvent(slug, ADVISOR_PUBLIC_EVENT.CONSULTATION_START)
    setConsultOpen(true)
  }

  const sharePage = async () => {
    if (!data) return
    trackAdvisorPublicEvent(slug, ADVISOR_PUBLIC_EVENT.SHARE_CLICK)
    const url = window.location.href
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${data.displayName} | ONE FC`, url })
        return
      } catch {
        /* cancel */
      }
    }
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      /* ignore */
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

  const titleSuffix = data.titleLabel?.trim() || 'FC'
  const officeParts = data.officeLine ? data.officeLine.split(/\s+/).length > 0 : false

  return (
    <div className="public-advisor-page">
      <div className="public-advisor-shell">
        <header className="pap-hero pap-hero--card">
          {data.profilePhotoUrl ? (
            <img className="pap-avatar pap-avatar--hero" src={data.profilePhotoUrl} alt={data.displayName} />
          ) : (
            <div className="pap-avatar pap-avatar--hero" aria-hidden />
          )}
          <h1 className="pap-name">{data.displayName} {titleSuffix}</h1>
          {data.gaName ? <p className="pap-affiliation pap-affiliation--strong">{data.gaName}</p> : null}
          {data.teamName ? <p className="pap-affiliation">{data.teamName}</p> : null}
          {data.officeLine ? <p className="pap-affiliation">{data.officeLine}</p> : null}
          {data.verificationBadges?.length ? (
            <div className="pap-badges">
              {data.verificationBadges.map((b) => (
                <span key={b.id} className="pap-badge">{b.label}</span>
              ))}
            </div>
          ) : null}
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
              <a
                className="pap-btn pap-btn--primary"
                href={`tel:${data.phoneNumber.replace(/\s/g, '')}`}
                onClick={() => trackAdvisorPublicEvent(slug, ADVISOR_PUBLIC_EVENT.PHONE_CLICK)}
              >
                전화
              </a>
            ) : null}
            {data.kakaoLink ? (
              <a
                className="pap-btn pap-btn--secondary"
                href={data.kakaoLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackAdvisorPublicEvent(slug, ADVISOR_PUBLIC_EVENT.CONTACT_CLICK)}
              >
                카카오톡
              </a>
            ) : null}
            {data.allowConsultation ? (
              <button type="button" className="pap-btn pap-btn--secondary" onClick={openConsult}>
                상담신청
              </button>
            ) : null}
            <button type="button" className="pap-btn pap-btn--secondary" onClick={() => void sharePage()}>
              공유
            </button>
          </div>
        </header>

        {data.bio ? (
          <section className="pap-section">
            <h2>자기소개</h2>
            <p className="pap-body">{data.bio}</p>
          </section>
        ) : null}

        {data.gallery?.length ? (
          <section className="pap-section pap-section--gallery">
            <h2>사진으로 보는 활동</h2>
            <div className="pap-gallery pap-gallery--prominent">
              {data.gallery.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="pap-gallery-tile"
                  onClick={() => g.imageUrl && setLightboxUrl(g.imageUrl)}
                >
                  {g.imageUrl ? (
                    <img src={g.imageUrl} alt={g.caption || '활동 사진'} loading="lazy" decoding="async" />
                  ) : null}
                  {g.caption ? <span className="pap-gallery-caption">{g.caption}</span> : null}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {data.careerText ? (
          <section className="pap-section">
            <h2>소속 / 경력</h2>
            <p className="pap-body">{data.careerText}</p>
          </section>
        ) : null}

        {officeParts ? (
          <section className="pap-section">
            <h2>사무실 위치</h2>
            <p className="pap-affiliation">{data.officeLine}</p>
          </section>
        ) : null}

        <section className="pap-section">
          <h2>상담 / 연락</h2>
          <div className="pap-cta-row pap-cta-row--left">
            {data.phoneNumber ? (
              <a
                className="pap-btn pap-btn--primary"
                href={`tel:${data.phoneNumber.replace(/\s/g, '')}`}
                onClick={() => trackAdvisorPublicEvent(slug, ADVISOR_PUBLIC_EVENT.PHONE_CLICK)}
              >
                전화
              </a>
            ) : null}
            {data.allowConsultation ? (
              <button type="button" className="pap-btn pap-btn--secondary" onClick={openConsult}>
                상담신청
              </button>
            ) : null}
          </div>
        </section>

        {submitDone ? <p role="status">상담 신청이 접수되었습니다.</p> : null}
        {error && data ? <p role="alert">{error}</p> : null}
      </div>

      {(data.phoneNumber || data.allowConsultation) ? (
        <div className="pap-sticky-cta">
          {data.phoneNumber ? (
            <a
              className="pap-btn pap-btn--primary"
              href={`tel:${data.phoneNumber.replace(/\s/g, '')}`}
              onClick={() => trackAdvisorPublicEvent(slug, ADVISOR_PUBLIC_EVENT.PHONE_CLICK)}
            >
              전화
            </a>
          ) : null}
          {data.allowConsultation ? (
            <button type="button" className="pap-btn pap-btn--secondary" onClick={openConsult}>
              상담신청
            </button>
          ) : null}
        </div>
      ) : null}

      {consultOpen ? (
        <div className="pap-modal-backdrop">
          <form className="pap-modal pap-modal--sheet" onSubmit={(e) => void onConsultSubmit(e)}>
            <h2>상담 신청</h2>
            <p className="pap-affiliation">입력한 정보가 상담을 위해 해당 설계사에게 전달됩니다.</p>
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

      {lightboxUrl ? (
        <div className="pap-lightbox" role="dialog" aria-modal="true" onClick={() => setLightboxUrl(null)}>
          <button type="button" className="pap-lightbox-close" onClick={() => setLightboxUrl(null)}>닫기</button>
          <img src={lightboxUrl} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      ) : null}
    </div>
  )
}

export default PublicAdvisorProfilePage

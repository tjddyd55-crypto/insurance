import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ADVISOR_PUBLIC_EVENT,
  fetchPublicAdvisorBySlug,
  submitAdvisorConsultation,
  trackAdvisorPublicEvent,
  type PublicAdvisorDetail,
} from '../api/publicAdvisorApi'
import { AdvisorProfileActionBar } from '../components/AdvisorProfileActionBar'
import { AdvisorPublicImage } from '../components/AdvisorPublicImage'
import { PublicAdvisorHeader } from '../components/PublicAdvisorHeader'
import '../public-advisor.css'

const MAX_PUBLIC_TAGS = 5

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

  const affiliationLine = useMemo(() => {
    if (!data) return ''
    return [data.gaName, data.teamName].filter(Boolean).join(' · ')
  }, [data])

  const publicTags = useMemo(() => (data?.hashtags ?? []).slice(0, MAX_PUBLIC_TAGS), [data?.hashtags])

  const infoBlocks = useMemo(() => {
    if (!data) return []
    const blocks: Array<{ label: string; value: string }> = []
    const affiliation = [data.gaName, data.teamName].filter(Boolean).join(' ')
    if (affiliation) blocks.push({ label: '소속', value: affiliation })
    if (data.careerText?.trim()) blocks.push({ label: '경력', value: data.careerText.trim() })
    if (data.officeLine?.trim()) blocks.push({ label: '사무실', value: data.officeLine.trim() })
    return blocks
  }, [data])

  if (error && !data) {
    return (
      <div className="public-advisor-page pap-page--fc">
        <PublicAdvisorHeader />
        <div className="public-advisor-shell pap-shell--fc"><p>{error}</p></div>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="public-advisor-page pap-page--fc">
        <PublicAdvisorHeader />
        <div className="public-advisor-shell pap-shell--fc"><p>불러오는 중…</p></div>
      </div>
    )
  }

  const titleSuffix = data.titleLabel?.trim() || 'FC'
  const primaryBadge = data.verificationBadges?.[0]

  return (
    <div className="public-advisor-page pap-page--fc">
      <PublicAdvisorHeader />
      <div className="public-advisor-shell pap-shell--fc">
        <header className="pap-hero pap-hero--billboard">
          <div className="pap-hero-photo-wrap">
            <AdvisorPublicImage
              className="pap-hero-photo"
              src={data.profilePhotoUrl}
              alt={data.displayName}
              loading="eager"
            />
          </div>
          <div className="pap-hero-body">
            <h1 className="pap-name pap-name--billboard">
              {data.displayName} {titleSuffix}
            </h1>
            {primaryBadge ? <p className="pap-verify-line">{primaryBadge.label}</p> : null}
            {affiliationLine ? (
              <p className="pap-affiliation pap-affiliation--strong pap-hero-line">{affiliationLine}</p>
            ) : null}
            {data.officeLine ? (
              <p className="pap-affiliation pap-hero-line pap-hero-office">{data.officeLine}</p>
            ) : null}
            {data.headline ? <p className="pap-headline pap-headline--billboard">{data.headline}</p> : null}
            {publicTags.length ? (
              <div className="pap-tags pap-tags--hero">
                {publicTags.map((tag) => (
                  <span key={tag} className="pap-tag">#{tag}</span>
                ))}
              </div>
            ) : null}
          </div>
          <AdvisorProfileActionBar
            phoneNumber={data.phoneNumber}
            kakaoLink={data.kakaoLink}
            allowConsultation={data.allowConsultation}
            onPhoneClick={() => trackAdvisorPublicEvent(slug, ADVISOR_PUBLIC_EVENT.PHONE_CLICK)}
            onKakaoClick={() => trackAdvisorPublicEvent(slug, ADVISOR_PUBLIC_EVENT.CONTACT_CLICK)}
            onConsultClick={openConsult}
            onShareClick={() => void sharePage()}
          />
        </header>

        <div className="pap-home-sections">
          {data.bio ? (
            <section className="pap-section pap-section--intro">
              <h2>소개</h2>
              <p className="pap-body pap-body--intro">{data.bio}</p>
            </section>
          ) : null}

          {data.gallery?.length ? (
            <section className="pap-section pap-section--gallery">
              <h2>활동 모습</h2>
              <div className="pap-gallery pap-gallery--prominent">
                {data.gallery.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="pap-gallery-tile"
                    onClick={() => g.imageUrl && setLightboxUrl(g.imageUrl)}
                  >
                    <AdvisorPublicImage
                      className="pap-gallery-img"
                      src={g.imageUrl}
                      alt={g.caption || '활동 사진'}
                    />
                    {g.caption ? <span className="pap-gallery-caption">{g.caption}</span> : null}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {infoBlocks.length ? (
            <section className="pap-section pap-section--facts">
              <h2 className="pap-section__sr-only">소속 및 연락 정보</h2>
              <dl className="pap-facts">
                {infoBlocks.map((block) => (
                  <div key={block.label} className="pap-facts__row">
                    <dt>{block.label}</dt>
                    <dd>{block.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {(data.phoneNumber || data.allowConsultation) ? (
            <section className="pap-section pap-section--contact pap-section--contact-inline">
              <h2>상담 문의</h2>
              <p className="pap-contact-lead">궁금한 점이 있으면 편하게 연락 주세요.</p>
              <div className="pap-cta-row pap-cta-row--left pap-cta-row--contact">
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
                    상담하기
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          {submitDone ? <p className="pap-status" role="status">상담 신청이 접수되었습니다.</p> : null}
          {error && data ? <p className="pap-error" role="alert">{error}</p> : null}
        </div>
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
              상담하기
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

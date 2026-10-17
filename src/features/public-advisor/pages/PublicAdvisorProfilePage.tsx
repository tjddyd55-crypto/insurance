import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ADVISOR_PUBLIC_EVENT,
  fetchPublicAdvisorBySlug,
  submitAdvisorConsultation,
  trackAdvisorPublicEvent,
  type PublicAdvisorDetail,
} from '../api/publicAdvisorApi'
import { AdvisorPublicProfileView } from '../components/AdvisorPublicProfileView'
import { AdvisorThemeDevSwitcher } from '../components/AdvisorThemeDevSwitcher'
import { isAdvisorThemeDevReviewEnabled } from '../config/advisorThemeDevReviewGate'
import { normalizeProfileTheme, type AdvisorProfileTheme } from '../profileTheme'
import { buildAdvisorPublicInfoBlocks } from '../utils/buildAdvisorPublicInfoBlocks'
import { normalizeAdvisorMediaUrl } from '../utils/advisorMediaUrl'
import '../public-advisor.css'

const MAX_PUBLIC_TAGS = 5

export function PublicAdvisorProfilePage() {
  const { slug = '' } = useParams()
  const [data, setData] = useState<PublicAdvisorDetail | null>(null)
  const [error, setError] = useState('')
  const [consultOpen, setConsultOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)
  const [devReviewHeroTheme, setDevReviewHeroTheme] = useState<AdvisorProfileTheme | null>(null)
  const showDevThemeReviewBar = isAdvisorThemeDevReviewEnabled()

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

  useEffect(() => {
    setDevReviewHeroTheme(null)
  }, [slug, data?.profileTheme])

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

  const affiliationLine = useMemo(() => {
    if (!data) return ''
    return [data.gaName, data.teamName].filter(Boolean).join(' · ')
  }, [data])

  const publicTags = useMemo(() => (data?.hashtags ?? []).slice(0, MAX_PUBLIC_TAGS), [data?.hashtags])

  const infoBlocks = useMemo(() => {
    if (!data) return []
    return buildAdvisorPublicInfoBlocks({
      gaName: data.gaName,
      teamName: data.teamName,
      careerText: data.careerText,
      officeLine: data.officeLine,
    })
  }, [data])

  const viewModel = useMemo(() => {
    if (!data) return null
    return {
      displayName: data.displayName,
      titleSuffix: data.titleLabel?.trim() || 'FC',
      gaName: data.gaName,
      teamName: data.teamName,
      heroDisplayEyebrow: data.heroDisplayEyebrow,
      heroDisplayTitle: data.heroDisplayTitle,
      heroDisplaySubtitle: data.heroDisplaySubtitle,
      profilePhotoUrl: normalizeAdvisorMediaUrl(data.profilePhotoUrl),
      primaryBadgeLabel: data.verificationBadges?.[0]?.label ?? null,
      affiliationLine,
      officeLine: data.officeLine,
      headline: data.headline,
      publicTags,
      phoneNumber: data.phoneNumber,
      kakaoLink: data.kakaoLink,
      allowConsultation: data.allowConsultation,
      bio: data.bio,
      businessCardFrontUrl: normalizeAdvisorMediaUrl(data.businessCardFrontUrl ?? null),
      gallery: (data.gallery ?? []).map((g) => ({
        id: g.id,
        caption: g.caption,
        imageUrl: normalizeAdvisorMediaUrl(g.imageUrl),
      })),
      infoBlocks,
    }
  }, [affiliationLine, data, infoBlocks, publicTags])

  if (error && !data) {
    return (
      <div className="public-advisor-page pap-page--fc">
        <div className="public-advisor-shell pap-shell--fc pap-shell--fc-state"><p>{error}</p></div>
      </div>
    )
  }
  if (!data || !viewModel) {
    return (
      <div className="public-advisor-page pap-page--fc">
        <div className="public-advisor-shell pap-shell--fc pap-shell--fc-state"><p>불러오는 중…</p></div>
      </div>
    )
  }

  const savedProfileTheme = normalizeProfileTheme(data.profileTheme)
  const profileTheme = devReviewHeroTheme ?? savedProfileTheme

  return (
    <>
      <AdvisorPublicProfileView
        theme={profileTheme}
        model={viewModel}
        slug={slug}
        variant="public"
        onConsultClick={openConsult}
        topSlot={
          showDevThemeReviewBar ? (
            <AdvisorThemeDevSwitcher value={profileTheme} onChange={setDevReviewHeroTheme} />
          ) : null
        }
      />

      {submitDone ? (
        <p className="pap-status pap-status--floating" role="status">상담 신청이 접수되었습니다.</p>
      ) : null}
      {error && data ? <p className="pap-error pap-error--floating" role="alert">{error}</p> : null}

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
    </>
  )
}

export default PublicAdvisorProfilePage

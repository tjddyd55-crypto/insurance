import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ADVISOR_PUBLIC_EVENT,
  fetchPublicAdvisorBySlug,
  submitAdvisorConsultation,
  trackAdvisorPublicEvent,
  type PublicAdvisorDetail,
} from '../api/publicAdvisorApi'
import { AdvisorPublicProfileView } from '../components/AdvisorPublicProfileView'
import { normalizeProfileTheme } from '../profileTheme'
import { buildAdvisorPublicInfoBlocks } from '../utils/buildAdvisorPublicInfoBlocks'
import { normalizeAdvisorMediaUrl } from '../utils/advisorMediaUrl'
import { AdvisorConsultationRequestModal } from '../components/AdvisorConsultationRequestModal'
import {
  classifyConsultSubmitError,
  isConsultDraftValid,
  type ConsultSubmitError,
} from '../utils/consultFormValidation'
import { PUBLIC_ADVISOR_CONSULT_SUCCESS_TOAST, showPublicAdvisorToast } from '../toast/publicAdvisorToast'
import {
  ADVISOR_SHARE_UNAVAILABLE_TITLE,
  buildAdvisorOgTitle,
} from '../utils/buildAdvisorShareMeta.js'
import '../public-advisor.css'

const MAX_PUBLIC_TAGS = 5

export function PublicAdvisorProfilePage() {
  const { slug = '' } = useParams()
  const [data, setData] = useState<PublicAdvisorDetail | null>(null)
  const [loadError, setLoadError] = useState('')
  const [consultOpen, setConsultOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<ConsultSubmitError | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchPublicAdvisorBySlug(slug)
      .then((row) => {
        if (!cancelled) {
          setData(row)
          document.title = buildAdvisorOgTitle({
            displayName: row.displayName,
            heroDisplayTitle: row.heroDisplayTitle,
            heroDisplayTitleVisible: row.heroDisplayTitleVisible,
          })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('프로필을 찾을 수 없습니다.')
          document.title = ADVISOR_SHARE_UNAVAILABLE_TITLE
        }
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const onConsultSubmit = async (payload: {
    name: string
    phone: string
    message: string
    contactChannel: 'phone' | 'sms' | 'kakao'
    privacyConsent: boolean
  }) => {
    if (!data || submitting || !isConsultDraftValid(payload)) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitAdvisorConsultation(slug, payload)
      setSubmitError(null)
      setConsultOpen(false)
      showPublicAdvisorToast(PUBLIC_ADVISOR_CONSULT_SUCCESS_TOAST)
    } catch (error) {
      setSubmitError(classifyConsultSubmitError(error))
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
      publicPhone: data.publicPhone,
      showPublicPhone: data.showPublicPhone,
      publicFax: data.publicFax,
      showPublicFax: data.showPublicFax,
      publicEmail: data.publicEmail,
      showPublicEmail: data.showPublicEmail,
      customContacts: (data.customContacts ?? []).map((c) => ({
        label: c.label,
        value: c.value,
        contactType: c.contactType,
        isVisible: true,
      })),
    })
  }, [data])

  const viewModel = useMemo(() => {
    if (!data) return null
    return {
      displayName: data.displayName,
      gaName: data.gaName,
      teamName: data.teamName,
      heroDisplayEyebrow: data.heroDisplayEyebrow ?? null,
      heroDisplayTitle: data.heroDisplayTitle ?? null,
      heroDisplaySubtitle: data.heroDisplaySubtitle ?? null,
      heroDisplayEyebrowVisible: data.heroDisplayEyebrowVisible,
      heroDisplayTitleVisible: data.heroDisplayTitleVisible,
      heroDisplaySubtitleVisible: data.heroDisplaySubtitleVisible,
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

  if (loadError && !data) {
    return (
      <div className="public-advisor-page pap-page--fc">
        <div className="public-advisor-shell pap-shell--fc pap-shell--fc-state"><p>{loadError}</p></div>
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

  const profileTheme = normalizeProfileTheme(data.profileTheme)

  return (
    <>
      <AdvisorPublicProfileView
        theme={profileTheme}
        model={viewModel}
        slug={slug}
        variant="public"
        onConsultClick={openConsult}
      />

      <AdvisorConsultationRequestModal
        open={consultOpen}
        submitting={submitting}
        submitError={submitError}
        onClose={() => {
          setConsultOpen(false)
          setSubmitError(null)
        }}
        onSubmitErrorClear={() => setSubmitError(null)}
        onSubmit={onConsultSubmit}
      />
    </>
  )
}

export default PublicAdvisorProfilePage

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AddressSearchField, FormButton } from '../../../components/form'
import { ApiError } from '../../../lib/apiClient'
import { useAuth } from '../../auth/AuthProvider'
import { canAccessSelfProfilePage } from '../../auth/roleGuards'
import {
  addAdvisorGalleryItem,
  ADVISOR_PUBLIC_EVENT,
  deleteAdvisorGalleryItem,
  fetchMyPublicProfile,
  patchMyPublicProfile,
  reorderAdvisorGallery,
  trackAdvisorPublicEvent,
  uploadAdvisorImageFile,
  type OwnerGalleryItem,
} from '../api/publicAdvisorApi'
import { buildAdvisorPublicPath } from '../advisorPublicRoutes'
import { AdvisorEditorMediaImage } from '../components/AdvisorEditorMediaImage'
import { AdvisorMobileCardThemePicker } from '../components/AdvisorMobileCardThemePicker'
import { AdvisorProfileQr } from '../components/AdvisorProfileQr'
import { AdvisorCustomContactsEditor, type CustomContactDraft } from '../components/AdvisorCustomContactsEditor'
import { AdvisorHeroEditorField } from '../components/AdvisorHeroEditorField'
import { resolveAdvisorPublicPhone } from '../utils/resolveAdvisorPublicPhone'
import { buildAdvisorOgTitle } from '../utils/buildAdvisorShareMeta.js'
import { AdvisorPublicProfileView } from '../components/AdvisorPublicProfileView'
import { normalizeProfileTheme, type AdvisorProfileTheme } from '../profileTheme'
import { RECOMMENDED_ADVISOR_HASHTAGS } from '../recommendedHashtags'
import { advisorMediaUrlFromObjectKey, normalizeAdvisorMediaUrl } from '../utils/advisorMediaUrl'
import { buildAdvisorPublicInfoBlocks } from '../utils/buildAdvisorPublicInfoBlocks'
import {
  advisorOfficeAddressFromProfile,
  advisorOfficeColumnsFromAddress,
  buildAdvisorOfficeDisplayLine,
  emptyAdvisorOfficeAddress,
} from '../utils/advisorOfficeAddress'
import { formatKrPhoneInputLive, formatKrPhoneNumberForDisplay } from '../utils/formatKrPhoneNumber'
import { resolveUserAffiliationText } from '../utils/resolveUserAffiliationText'
import '../public-advisor.css'

const GALLERY_MAX = 6
const HASHTAG_MAX = 5

function parseHashtags(raw: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const part of raw.split(/[,\s#]+/)) {
    const tag = part.trim().replace(/^#+/, '')
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tag.slice(0, 40))
    if (out.length >= HASHTAG_MAX) break
  }
  return out
}

function revokeBlobUrl(url: string | null | undefined) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}

function loadProfileTextField(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function serializeEditorSnapshot(input: Record<string, unknown>): string {
  return JSON.stringify(input)
}

export function MyPublicProfilePage() {
  const { token, user, isAuthenticated } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [slug, setSlug] = useState('')
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [careerText, setCareerText] = useState('')
  const [heroDisplayEyebrow, setHeroDisplayEyebrow] = useState('')
  const [heroDisplayTitle, setHeroDisplayTitle] = useState('')
  const [heroDisplaySubtitle, setHeroDisplaySubtitle] = useState('')
  const [heroEyebrowVisible, setHeroEyebrowVisible] = useState(true)
  const [heroTitleVisible, setHeroTitleVisible] = useState(true)
  const [heroSubtitleVisible, setHeroSubtitleVisible] = useState(true)
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [publicPhone, setPublicPhone] = useState('')
  const [publicFax, setPublicFax] = useState('')
  const [publicEmail, setPublicEmail] = useState('')
  const [showPublicPhone, setShowPublicPhone] = useState(true)
  const [showPublicFax, setShowPublicFax] = useState(false)
  const [showPublicEmail, setShowPublicEmail] = useState(false)
  const [customContacts, setCustomContacts] = useState<CustomContactDraft[]>([])
  const [allowConsultation, setAllowConsultation] = useState(true)
  const [profileTheme, setProfileTheme] = useState<AdvisorProfileTheme>('classic')
  const [address, setAddress] = useState(() => emptyAdvisorOfficeAddress())
  const [profilePhotoObjectKey, setProfilePhotoObjectKey] = useState<string | null>(null)
  const [businessCardObjectKey, setBusinessCardObjectKey] = useState<string | null>(null)
  const [profilePhotoPreviewUrl, setProfilePhotoPreviewUrl] = useState<string | null>(null)
  const [businessCardPreviewUrl, setBusinessCardPreviewUrl] = useState<string | null>(null)
  const [gallery, setGallery] = useState<OwnerGalleryItem[]>([])
  const [ownerGaName, setOwnerGaName] = useState('')
  const [ownerTeamName, setOwnerTeamName] = useState('')
  const [ownerDisplayName, setOwnerDisplayName] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [verificationBadgeLabel, setVerificationBadgeLabel] = useState<string | null>(null)
  const [qrOpen, setQrOpen] = useState(false)
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  const [mediaBusy, setMediaBusy] = useState(false)
  const profileBlobRef = useRef<string | null>(null)
  const businessCardBlobRef = useRef<string | null>(null)
  const profileInputRef = useRef<HTMLInputElement>(null)
  const businessCardFrontInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      revokeBlobUrl(profileBlobRef.current)
      revokeBlobUrl(businessCardBlobRef.current)
    }
  }, [])

  const setProfilePhotoPreview = useCallback((url: string | null) => {
    setProfilePhotoPreviewUrl(url)
  }, [])

  const setBusinessCardPreview = useCallback((url: string | null) => {
    setBusinessCardPreviewUrl(url)
  }, [])

  const applyProfilePhotoFromServer = useCallback((objectKey: string | null, serverUrl: string | null) => {
    revokeBlobUrl(profileBlobRef.current)
    profileBlobRef.current = null
    setProfilePhotoObjectKey(objectKey)
    const normalized = normalizeAdvisorMediaUrl(serverUrl) ?? (objectKey ? advisorMediaUrlFromObjectKey(objectKey) : null)
    setProfilePhotoPreview(normalized)
  }, [setProfilePhotoPreview])

  const applyBusinessCardFromServer = useCallback((objectKey: string | null, serverUrl: string | null) => {
    revokeBlobUrl(businessCardBlobRef.current)
    businessCardBlobRef.current = null
    setBusinessCardObjectKey(objectKey)
    const normalized =
      normalizeAdvisorMediaUrl(serverUrl) ?? (objectKey ? advisorMediaUrlFromObjectKey(objectKey) : null)
    setBusinessCardPreview(normalized)
  }, [setBusinessCardPreview])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const data = await fetchMyPublicProfile(token)
      const p = data.profile as Record<string, unknown>
      setSlug(String(p.public_slug ?? ''))
      setHeadline(String(p.headline ?? ''))
      setBio(String(p.bio ?? ''))
      setCareerText(String(p.career_text ?? ''))
      setHeroDisplayEyebrow(loadProfileTextField(p.hero_display_eyebrow))
      setHeroDisplayTitle(loadProfileTextField(p.hero_display_title))
      setHeroDisplaySubtitle(loadProfileTextField(p.hero_display_subtitle))
      setHeroEyebrowVisible(p.hero_display_eyebrow_visible !== false)
      setHeroTitleVisible(p.hero_display_title_visible !== false)
      setHeroSubtitleVisible(p.hero_display_subtitle_visible !== false)
      setHashtags(Array.isArray(p.hashtags) ? (p.hashtags as string[]) : [])
      setIsPublished(Boolean(p.is_published))
      setPublicPhone(formatKrPhoneNumberForDisplay(loadProfileTextField(p.public_phone)))
      setPublicFax(formatKrPhoneNumberForDisplay(loadProfileTextField(p.public_fax)))
      setPublicEmail(loadProfileTextField(p.public_email))
      setShowPublicPhone(p.show_public_phone !== false)
      setShowPublicFax(p.show_public_fax === true)
      setShowPublicEmail(p.show_public_email === true)
      setCustomContacts(
        (data.customContacts ?? []).map((c) => ({
          id: String(c.id),
          label: String(c.label ?? ''),
          value: String(c.value ?? ''),
          contactType: (c.contactType as CustomContactDraft['contactType']) || 'text',
          isVisible: c.isVisible !== false,
        })),
      )
      setAllowConsultation(p.allow_consultation !== false)
      setProfileTheme(normalizeProfileTheme(p.profile_theme))
      const loadedAddress = advisorOfficeAddressFromProfile(p)
      setAddress(loadedAddress)
      const photoKey = String(p.profile_photo_object_key ?? '').trim() || null
      const cardKey = String(p.business_card_front_object_key ?? '').trim() || null
      applyProfilePhotoFromServer(photoKey, data.profilePhotoUrl)
      applyBusinessCardFromServer(cardKey, data.businessCardFrontUrl)
      setGallery(
        data.gallery.map((g) => ({
          ...g,
          imageUrl: normalizeAdvisorMediaUrl(g.imageUrl),
        })),
      )
      setOwnerDisplayName(data.user.displayName ?? '')
      setOwnerGaName(data.user.gaName ?? '')
      setOwnerTeamName(data.user.teamName ?? '')
      setOwnerPhone(data.user.phoneNumber ?? '')
      setVerificationBadgeLabel(data.verificationBadges?.[0]?.label ?? null)
      setSavedSnapshot(
        serializeEditorSnapshot({
          slug: String(p.public_slug ?? ''),
          headline: String(p.headline ?? ''),
          bio: String(p.bio ?? ''),
          careerText: String(p.career_text ?? ''),
          heroDisplayEyebrow: loadProfileTextField(p.hero_display_eyebrow),
          heroDisplayTitle: loadProfileTextField(p.hero_display_title),
          heroDisplaySubtitle: loadProfileTextField(p.hero_display_subtitle),
          heroEyebrowVisible: p.hero_display_eyebrow_visible !== false,
          heroTitleVisible: p.hero_display_title_visible !== false,
          heroSubtitleVisible: p.hero_display_subtitle_visible !== false,
          hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
          isPublished: Boolean(p.is_published),
          publicPhone: loadProfileTextField(p.public_phone),
          publicFax: loadProfileTextField(p.public_fax),
          publicEmail: loadProfileTextField(p.public_email),
          showPublicPhone: p.show_public_phone !== false,
          showPublicFax: p.show_public_fax === true,
          showPublicEmail: p.show_public_email === true,
          customContacts: (data.customContacts ?? []).map((c) => ({
            id: String(c.id),
            label: String(c.label ?? ''),
            value: String(c.value ?? ''),
            contactType: c.contactType,
            isVisible: c.isVisible !== false,
          })),
          allowConsultation: p.allow_consultation !== false,
          profileTheme: normalizeProfileTheme(p.profile_theme),
          address: loadedAddress,
          profilePhotoObjectKey: String(p.profile_photo_object_key ?? '').trim() || null,
          businessCardObjectKey: String(p.business_card_front_object_key ?? '').trim() || null,
        }),
      )
    } finally {
      setLoading(false)
    }
  }, [applyBusinessCardFromServer, applyProfilePhotoFromServer, token])

  useEffect(() => {
    void load()
  }, [load])

  const canonicalPublicUrl = useMemo(() => {
    const normalized = slug.trim()
    if (!normalized) return ''
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}${buildAdvisorPublicPath(normalized)}`
  }, [slug])

  const addTag = (raw: string) => {
    const next = parseHashtags([...hashtags, raw].join(' '))
    setHashtags(next)
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setHashtags(hashtags.filter((t) => t !== tag))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    setMessage('')
    try {
      await patchMyPublicProfile(token, {
        public_slug: slug,
        headline,
        bio,
        career_text: careerText,
        hero_display_eyebrow: heroDisplayEyebrow,
        hero_display_title: heroDisplayTitle,
        hero_display_subtitle: heroDisplaySubtitle,
        hero_display_eyebrow_visible: heroEyebrowVisible,
        hero_display_title_visible: heroTitleVisible,
        hero_display_subtitle_visible: heroSubtitleVisible,
        hashtags,
        is_published: isPublished,
        public_phone: publicPhone,
        public_fax: publicFax,
        public_email: publicEmail,
        show_public_phone: showPublicPhone,
        show_public_fax: showPublicFax,
        show_public_email: showPublicEmail,
        show_phone: false,
        show_kakao: false,
        custom_contacts: customContacts.map((c, index) => ({
          label: c.label,
          value: c.value,
          contact_type: c.contactType,
          is_visible: c.isVisible,
          sort_order: index,
        })),
        kakao_link: '',
        allow_consultation: allowConsultation,
        profile_theme: profileTheme,
        ...advisorOfficeColumnsFromAddress(address),
        profile_photo_object_key: profilePhotoObjectKey ?? '',
        business_card_front_object_key: businessCardObjectKey ?? '',
      })
      setMessage('저장되었습니다.')
      await load()
    } catch (err) {
      console.error('[MyPublicProfilePage] save failed', err)
      const detail = err instanceof ApiError ? err.message : ''
      setMessage(detail ? `저장에 실패했습니다. (${detail})` : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const editorSnapshot = useMemo(
    () =>
      serializeEditorSnapshot({
        slug,
        headline,
        bio,
        careerText,
        heroDisplayEyebrow,
        heroDisplayTitle,
        heroDisplaySubtitle,
        heroEyebrowVisible,
        heroTitleVisible,
        heroSubtitleVisible,
        hashtags,
        isPublished,
        publicPhone,
        publicFax,
        publicEmail,
        showPublicPhone,
        showPublicFax,
        showPublicEmail,
        customContacts,
        allowConsultation,
        profileTheme,
        address,
        profilePhotoObjectKey,
        businessCardObjectKey,
      }),
    [
      address,
      allowConsultation,
      bio,
      businessCardObjectKey,
      careerText,
      hashtags,
      headline,
      heroDisplayEyebrow,
      heroDisplayTitle,
      heroDisplaySubtitle,
      heroEyebrowVisible,
      heroTitleVisible,
      heroSubtitleVisible,
      isPublished,
      profilePhotoObjectKey,
      profileTheme,
      slug,
    ],
  )

  const isEditorDirty = savedSnapshot !== '' && editorSnapshot !== savedSnapshot

  const shareGuardMessage = (): string | null => {
    if (!slug.trim()) return '공개 주소를 먼저 저장해 주세요.'
    if (!isPublished) return '모바일 명함을 공개한 후 공유할 수 있습니다.'
    if (isEditorDirty) return '변경 사항을 저장한 후 공유해 주세요.'
    return null
  }

  const copyLink = async () => {
    const block = shareGuardMessage()
    if (block) {
      setMessage(block)
      return
    }
    if (!canonicalPublicUrl) return
    try {
      await navigator.clipboard.writeText(canonicalPublicUrl)
      setMessage('공개 링크를 복사했습니다.')
      if (slug) trackAdvisorPublicEvent(slug, ADVISOR_PUBLIC_EVENT.SHARE_CLICK)
    } catch {
      setMessage('링크 복사에 실패했습니다.')
    }
  }

  const shareLink = async () => {
    const block = shareGuardMessage()
    if (block) {
      setMessage(block)
      return
    }
    if (!canonicalPublicUrl) return
    if (slug) trackAdvisorPublicEvent(slug, ADVISOR_PUBLIC_EVENT.SHARE_CLICK)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: buildAdvisorOgTitle({
            displayName: user.displayName,
            heroDisplayTitle,
            heroDisplayTitleVisible: heroTitleVisible,
          }),
          url: canonicalPublicUrl,
        })
        return
      } catch {
        /* 사용자 취소 */
      }
    }
    await copyLink()
  }

  const onProfilePhotoPick = async (file: File | null) => {
    if (!file || !token) return
    setMediaBusy(true)
    setMessage('')
    try {
      const { objectKey } = await uploadAdvisorImageFile(token, 'profile', file)
      revokeBlobUrl(profileBlobRef.current)
      const blobUrl = URL.createObjectURL(file)
      profileBlobRef.current = blobUrl
      setProfilePhotoObjectKey(objectKey)
      setProfilePhotoPreview(blobUrl)
      setMessage('대표사진을 올렸습니다. 저장 버튼을 눌러 반영해 주세요.')
    } catch (err) {
      console.error('[MyPublicProfilePage] profile photo upload failed', err)
      setMessage('대표사진 업로드에 실패했습니다.')
    } finally {
      setMediaBusy(false)
    }
  }

  const onBusinessCardPick = async (file: File | null) => {
    if (!file || !token) return
    setMediaBusy(true)
    setMessage('')
    try {
      const { objectKey } = await uploadAdvisorImageFile(token, 'business-card-front', file)
      revokeBlobUrl(businessCardBlobRef.current)
      const blobUrl = URL.createObjectURL(file)
      businessCardBlobRef.current = blobUrl
      setBusinessCardObjectKey(objectKey)
      setBusinessCardPreview(blobUrl)
      setMessage('명함 사진을 올렸습니다. 저장 버튼을 눌러 반영해 주세요.')
    } catch (err) {
      console.error('[MyPublicProfilePage] business card upload failed', err)
      setMessage('명함 사진 업로드에 실패했습니다.')
    } finally {
      setMediaBusy(false)
    }
  }

  const removeBusinessCard = () => {
    revokeBlobUrl(businessCardBlobRef.current)
    businessCardBlobRef.current = null
    setBusinessCardObjectKey(null)
    setBusinessCardPreview(null)
    setMessage('명함 사진을 제거했습니다. 저장 버튼을 눌러 반영해 주세요.')
  }

  const removeProfilePhoto = () => {
    revokeBlobUrl(profileBlobRef.current)
    profileBlobRef.current = null
    setProfilePhotoObjectKey(null)
    setProfilePhotoPreview(null)
    setMessage('대표사진을 제거했습니다. 저장 버튼을 눌러 반영해 주세요.')
  }

  const onGalleryPick = async (file: File | null) => {
    if (!file || !token) return
    if (gallery.length >= GALLERY_MAX) {
      setMessage(`사진은 최대 ${GALLERY_MAX}장까지 등록할 수 있습니다.`)
      return
    }
    setMediaBusy(true)
    setMessage('')
    try {
      const { objectKey } = await uploadAdvisorImageFile(token, 'gallery', file)
      await addAdvisorGalleryItem(token, objectKey)
      setMessage('사진이 추가되었습니다.')
      await load()
    } catch (err) {
      console.error('[MyPublicProfilePage] gallery upload failed', err)
      setMessage('사진 업로드에 실패했습니다.')
    } finally {
      setMediaBusy(false)
    }
  }

  const moveGallery = async (id: string, dir: -1 | 1) => {
    if (!token) return
    const idx = gallery.findIndex((g) => g.id === id)
    if (idx < 0) return
    const swap = idx + dir
    if (swap < 0 || swap >= gallery.length) return
    const ordered = [...gallery]
    const [item] = ordered.splice(idx, 1)
    ordered.splice(swap, 0, item)
    await reorderAdvisorGallery(token, ordered.map((g) => g.id))
    await load()
  }

  const removeGalleryItem = async (id: string) => {
    if (!token) return
    setMediaBusy(true)
    try {
      await deleteAdvisorGalleryItem(token, id)
      await load()
    } catch {
      setMessage('사진 삭제에 실패했습니다.')
    } finally {
      setMediaBusy(false)
    }
  }

  const userAffiliation = resolveUserAffiliationText({
    heroDisplaySubtitle,
    heroDisplaySubtitleVisible: heroSubtitleVisible,
  })
  const officePreviewLine = buildAdvisorOfficeDisplayLine(address)

  const livePreviewModel = useMemo(() => {
    const phoneForPreview = resolveAdvisorPublicPhone({
      publicPhone,
      showPublicPhone,
      accountPhone: ownerPhone,
    })
    return {
      displayName: ownerDisplayName || user?.displayName || '',
      gaName: ownerGaName,
      teamName: ownerTeamName,
      heroDisplayEyebrow,
      heroDisplayTitle,
      heroDisplaySubtitle,
      heroDisplayEyebrowVisible: heroEyebrowVisible,
      heroDisplayTitleVisible: heroTitleVisible,
      heroDisplaySubtitleVisible: heroSubtitleVisible,
      profilePhotoUrl: profilePhotoPreviewUrl,
      primaryBadgeLabel: verificationBadgeLabel,
      affiliationLine: userAffiliation,
      officeLine: officePreviewLine,
      headline: headline.trim(),
      publicTags: hashtags,
      phoneNumber: phoneForPreview,
      kakaoLink: '',
      allowConsultation,
      bio,
      businessCardFrontUrl: businessCardPreviewUrl,
      gallery: gallery.map((g) => ({
        id: g.id,
        caption: g.caption,
        imageUrl: g.imageUrl,
      })),
      infoBlocks: buildAdvisorPublicInfoBlocks({
        affiliationText: userAffiliation,
        gaName: ownerGaName,
        teamName: ownerTeamName,
        careerText,
        officeLine: officePreviewLine,
        publicPhone,
        showPublicPhone,
        publicFax,
        showPublicFax,
        publicEmail,
        showPublicEmail,
        customContacts: customContacts.map((c) => ({
          label: c.label,
          value: c.value,
          contactType: c.contactType,
          isVisible: c.isVisible,
        })),
      }),
    }
  }, [
    allowConsultation,
    bio,
    businessCardPreviewUrl,
    careerText,
    userAffiliation,
    hashtags,
    headline,
    gallery,
    officePreviewLine,
    ownerDisplayName,
    ownerGaName,
    ownerPhone,
    ownerTeamName,
    profilePhotoPreviewUrl,
    publicPhone,
    publicFax,
    publicEmail,
    showPublicPhone,
    showPublicFax,
    showPublicEmail,
    customContacts,
    heroEyebrowVisible,
    heroTitleVisible,
    heroSubtitleVisible,
    heroDisplayEyebrow,
    heroDisplayTitle,
    heroDisplaySubtitle,
    user?.displayName,
    verificationBadgeLabel,
  ])

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (!canAccessSelfProfilePage(user.role)) return <Navigate to="/dashboard" replace />

  const livePreviewPanel = (
    <aside className="pap-editor-layout__preview" aria-label="모바일 미리보기">
      <h2 className="pap-editor-live-preview__title">모바일 미리보기</h2>
      <div className="pap-editor-live-preview__frame pap-editor-live-preview__frame--phone">
        <div className="pap-editor-live-preview__scroll pap-theme-preview-shell pap-editor-live-preview__scroll--phone">
          <AdvisorPublicProfileView
            theme={profileTheme}
            model={livePreviewModel}
            variant="preview"
            onShareClick={() => void shareLink()}
          />
        </div>
      </div>
    </aside>
  )

  return (
    <div className="page-shell pap-editor-page">
      <h1>내 모바일 명함</h1>
      <p className="pap-editor-hint">고객에게 공유할 모바일 명함과 소개 페이지를 꾸밀 수 있습니다.</p>

      <section className="pap-editor-toolbar">
        <label className="pap-editor-toggle">
          <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
          공개 ON
        </label>
        <div className="pap-cta-row pap-cta-row--left">
          {slug ? (
            <Link className="pap-btn pap-btn--secondary" to={buildAdvisorPublicPath(slug)} target="_blank" rel="noopener noreferrer">
              내 명함 보기
            </Link>
          ) : null}
          <button type="button" className="pap-btn pap-btn--secondary pap-editor-preview-fallback" onClick={() => setMobilePreviewOpen(true)}>
            미리보기
          </button>
          <button type="button" className="pap-btn pap-btn--secondary" onClick={() => void shareLink()}>공유</button>
          <button type="button" className="pap-btn pap-btn--secondary" onClick={() => setQrOpen(true)} disabled={!canonicalPublicUrl}>QR</button>
          <button type="button" className="pap-btn pap-btn--secondary" onClick={() => void copyLink()} disabled={!canonicalPublicUrl}>링크 복사</button>
        </div>
      </section>

      {loading ? <p>불러오는 중…</p> : null}

      <div className="pap-editor-layout">
        <form className="pap-editor-form pap-editor-layout__main" onSubmit={(e) => void onSubmit(e)}>
          <h2 className="pap-editor-section-title">명함 디자인</h2>
          <p className="pap-editor-hint">선택한 디자인은 오른쪽 미리보기에 즉시 반영됩니다.</p>
          <AdvisorMobileCardThemePicker value={profileTheme} onChange={setProfileTheme} disabled={saving || mediaBusy} />

          <h2 className="pap-editor-section-title">프로필 대표사진</h2>
          <div className="pap-editor-photo-row">
            <AdvisorEditorMediaImage
              className="pap-editor-avatar"
              src={profilePhotoPreviewUrl}
              alt="대표사진 미리보기"
              fit="cover"
            />
            <div className="pap-cta-row pap-cta-row--left">
              <button type="button" className="pap-btn pap-btn--secondary" disabled={mediaBusy} onClick={() => profileInputRef.current?.click()}>
                {profilePhotoPreviewUrl ? '변경' : '등록'}
              </button>
              {profilePhotoPreviewUrl ? (
                <button type="button" className="pap-btn pap-btn--secondary" disabled={mediaBusy} onClick={() => removeProfilePhoto()}>
                  삭제
                </button>
              ) : null}
            </div>
            <input
              ref={profileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="pap-hidden-input"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                e.target.value = ''
                void onProfilePhotoPick(f)
              }}
            />
          </div>

          <h2 className="pap-editor-section-title">실제 명함 사진</h2>
          <p className="pap-editor-hint">사용 중인 종이 명함 앞면을 등록해 주세요.</p>
          <div className="pap-editor-business-card-row">
            <div className="pap-editor-business-card-slot">
              {businessCardPreviewUrl ? (
                <AdvisorEditorMediaImage
                  className="pap-editor-business-card-thumb"
                  src={businessCardPreviewUrl}
                  alt="명함 앞면"
                  fit="contain"
                />
              ) : (
                <p className="pap-affiliation">등록된 명함이 없습니다.</p>
              )}
              <div className="pap-cta-row pap-cta-row--left">
                <button type="button" className="pap-btn pap-btn--secondary" disabled={mediaBusy} onClick={() => businessCardFrontInputRef.current?.click()}>
                  {businessCardPreviewUrl ? '변경' : '+ 명함 사진 추가'}
                </button>
                {businessCardPreviewUrl ? (
                  <button type="button" className="pap-btn pap-btn--secondary" disabled={mediaBusy} onClick={() => removeBusinessCard()}>
                    삭제
                  </button>
                ) : null}
              </div>
              <input
                ref={businessCardFrontInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="pap-hidden-input"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  e.target.value = ''
                  void onBusinessCardPick(f)
                }}
              />
            </div>
          </div>

        <h2 className="pap-editor-section-title">Hero 표시 문구</h2>
        <p className="pap-editor-hint">
          입력한 문구만 Hero에 표시됩니다. 비노출을 선택하면 해당 슬롯만 숨기고, 문구는 그대로 유지됩니다.
        </p>
        <AdvisorHeroEditorField
          label="상단 라벨 / 브랜드 문구"
          hint="Hero 상단 라벨 슬롯"
          placeholder="ONE FC"
          value={heroDisplayEyebrow}
          visible={heroEyebrowVisible}
          maxLength={80}
          onChange={setHeroDisplayEyebrow}
          onToggleVisible={() => setHeroEyebrowVisible((v) => !v)}
        />
        <AdvisorHeroEditorField
          label="대표 표시 이름"
          hint="Hero 대표 이름 슬롯"
          placeholder="홍길동 FC"
          value={heroDisplayTitle}
          visible={heroTitleVisible}
          maxLength={120}
          onChange={setHeroDisplayTitle}
          onToggleVisible={() => setHeroTitleVisible((v) => !v)}
        />
        <AdvisorHeroEditorField
          label="보조 소속/직책 문구"
          hint="Hero 보조 문구 슬롯"
          placeholder="영진에셋 · 팀장"
          value={heroDisplaySubtitle}
          visible={heroSubtitleVisible}
          maxLength={200}
          onChange={setHeroDisplaySubtitle}
          onToggleVisible={() => setHeroSubtitleVisible((v) => !v)}
        />

        <h2 className="pap-editor-section-title">기본 표시정보</h2>
        <p className="pap-affiliation">
          <strong>{ownerDisplayName || user.displayName}</strong>
          {userAffiliation ? ` · ${userAffiliation}` : ''}
        </p>
        <label>공개 주소 (영문·숫자·하이픈)<input value={slug} onChange={(e) => setSlug(e.target.value)} /></label>

          <h2 className="pap-editor-section-title">사무실 위치</h2>
          <label className="pap-editor-address">
            <span className="pap-editor-field-hint">사무실 주소</span>
            <AddressSearchField value={address} onChange={setAddress} clearable />
          </label>

          <label>경력/소속<textarea value={careerText} onChange={(e) => setCareerText(e.target.value)} maxLength={2000} /></label>

          <h2 className="pap-editor-section-title">한 줄 소개</h2>
          <label><input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={200} /></label>

          <h2 className="pap-editor-section-title">자기소개</h2>
          <label><textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={8000} /></label>

          <h2 className="pap-editor-section-title">해시태그 (최대 {HASHTAG_MAX}개)</h2>
          <div className="pap-tags pap-tags--left">
            {hashtags.map((tag) => (
              <button key={tag} type="button" className="pap-tag pap-tag--editable" onClick={() => removeTag(tag)}>
                #{tag} ×
              </button>
            ))}
          </div>
          <div className="pap-tag-suggest">
            {RECOMMENDED_ADVISOR_HASHTAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className="pap-tag pap-tag--suggest"
                disabled={hashtags.length >= HASHTAG_MAX || hashtags.some((t) => t.toLowerCase() === tag.toLowerCase())}
                onClick={() => addTag(tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
          <label>
            직접 입력
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="태그 입력 후 Enter"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (hashtags.length < HASHTAG_MAX && tagInput.trim()) addTag(tagInput)
                }
              }}
            />
          </label>

          <h2 className="pap-editor-section-title">활동 사진 (최대 {GALLERY_MAX}장)</h2>
          <div className="pap-editor-gallery">
            {gallery.map((g, index) => (
              <div key={g.id} className="pap-editor-gallery-item">
                <AdvisorEditorMediaImage className="pap-editor-gallery-item__img" src={g.imageUrl} alt="" fit="cover" />
                <div className="pap-editor-gallery-actions">
                  <button type="button" disabled={index === 0} onClick={() => void moveGallery(g.id, -1)}>↑</button>
                  <button type="button" disabled={index === gallery.length - 1} onClick={() => void moveGallery(g.id, 1)}>↓</button>
                  <button type="button" onClick={() => void removeGalleryItem(g.id)}>삭제</button>
                </div>
              </div>
            ))}
          </div>
          {gallery.length < GALLERY_MAX ? (
            <button type="button" className="pap-btn pap-btn--secondary" disabled={mediaBusy} onClick={() => galleryInputRef.current?.click()}>
              사진 추가
            </button>
          ) : null}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="pap-hidden-input"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              e.target.value = ''
              void onGalleryPick(f)
            }}
          />

          <h2 className="pap-editor-section-title">연락처 정보</h2>
          <p className="pap-editor-hint">모바일 명함에 표시할 연락처입니다. 계정 전화번호와 별도로 관리됩니다.</p>
          <AdvisorHeroEditorField
            label="전화번호"
            hint="공개 전화번호"
            placeholder="010-1234-5678"
            value={publicPhone}
            visible={showPublicPhone}
            maxLength={40}
            onChange={(v) => setPublicPhone(formatKrPhoneInputLive(v))}
            onToggleVisible={() => setShowPublicPhone((v) => !v)}
          />
          <AdvisorHeroEditorField
            label="팩스번호"
            hint="표시만 (클릭 동작 없음)"
            placeholder="02-1234-5678"
            value={publicFax}
            visible={showPublicFax}
            maxLength={40}
            onChange={(v) => setPublicFax(formatKrPhoneInputLive(v))}
            onToggleVisible={() => setShowPublicFax((v) => !v)}
          />
          <AdvisorHeroEditorField
            label="이메일 주소"
            hint="클릭 시 메일 앱"
            placeholder="example@email.com"
            value={publicEmail}
            visible={showPublicEmail}
            maxLength={120}
            onChange={setPublicEmail}
            onToggleVisible={() => setShowPublicEmail((v) => !v)}
          />

          <h3 className="pap-editor-subsection-title">추가정보 입력</h3>
          <AdvisorCustomContactsEditor items={customContacts} max={8} onChange={setCustomContacts} />

          <h2 className="pap-editor-section-title">연락 기능 설정</h2>
          <div className="pap-editor-toggle-row">
            <span>상담 신청 받기</span>
            <input type="checkbox" checked={allowConsultation} onChange={(e) => setAllowConsultation(e.target.checked)} />
          </div>

          <div className="pap-cta-row pap-cta-row--left" style={{ marginTop: 24 }}>
            <FormButton htmlType="submit" variant="primary" disabled={saving || mediaBusy}>
              {saving ? '저장 중…' : '저장'}
            </FormButton>
          </div>
          {canonicalPublicUrl ? <p className="pap-affiliation"><code>{canonicalPublicUrl}</code></p> : null}
          {message ? <p role="status">{message}</p> : null}
        </form>

        {livePreviewPanel}
      </div>

      <AdvisorProfileQr
        url={canonicalPublicUrl}
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        onView={() => {
          if (slug) trackAdvisorPublicEvent(slug, ADVISOR_PUBLIC_EVENT.QR_VIEW)
        }}
      />

      {mobilePreviewOpen ? (
        <div className="pap-theme-preview-modal" role="dialog" aria-modal="true" aria-label="모바일 명함 미리보기">
          <button type="button" className="pap-theme-preview-modal__backdrop" aria-label="닫기" onClick={() => setMobilePreviewOpen(false)} />
          <div className="pap-theme-preview-modal__panel">
            <div className="pap-theme-preview-modal__toolbar">
              <strong>390px 미리보기</strong>
              <button type="button" className="pap-btn pap-btn--secondary" onClick={() => setMobilePreviewOpen(false)}>
                닫기
              </button>
            </div>
            <div className={`pap-theme-preview-modal__viewport pap-theme-preview-shell pap-page-theme--${profileTheme}`}>
              <AdvisorPublicProfileView
            theme={profileTheme}
            model={livePreviewModel}
            variant="preview"
            onShareClick={() => void shareLink()}
          />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default MyPublicProfilePage

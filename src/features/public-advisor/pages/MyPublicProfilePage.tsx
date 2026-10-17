import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { ApiError } from '../../../lib/apiClient'
import { useAuth } from '../../auth/AuthProvider'
import { canAccessSelfProfilePage } from '../../auth/roleGuards'
import { AddressSearchField, type AddressSearchValue } from '../../../components/form'
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
import { AdvisorPublicProfileView } from '../components/AdvisorPublicProfileView'
import { normalizeProfileTheme, type AdvisorProfileTheme } from '../profileTheme'
import { RECOMMENDED_ADVISOR_HASHTAGS } from '../recommendedHashtags'
import { advisorMediaUrlFromObjectKey, normalizeAdvisorMediaUrl } from '../utils/advisorMediaUrl'
import { buildAdvisorPublicInfoBlocks } from '../utils/buildAdvisorPublicInfoBlocks'
import '../public-advisor.css'

const GALLERY_MAX = 6
const HASHTAG_MAX = 5

const emptyAddress: AddressSearchValue = {
  postalCode: '',
  roadAddress: '',
  jibunAddress: '',
  addressDetail: '',
}

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

export function MyPublicProfilePage() {
  const { token, user, isAuthenticated } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [publicUrl, setPublicUrl] = useState('')
  const [slug, setSlug] = useState('')
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [careerText, setCareerText] = useState('')
  const [titleLabel, setTitleLabel] = useState('FC')
  const [heroDisplayEyebrow, setHeroDisplayEyebrow] = useState('')
  const [heroDisplayTitle, setHeroDisplayTitle] = useState('')
  const [heroDisplaySubtitle, setHeroDisplaySubtitle] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [showPhone, setShowPhone] = useState(true)
  const [showKakao, setShowKakao] = useState(false)
  const [kakaoLink, setKakaoLink] = useState('')
  const [allowConsultation, setAllowConsultation] = useState(true)
  const [profileTheme, setProfileTheme] = useState<AdvisorProfileTheme>('classic')
  const [address, setAddress] = useState<AddressSearchValue>(emptyAddress)
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
      setTitleLabel(String(p.title_label ?? 'FC'))
      setHeroDisplayEyebrow(String(p.hero_display_eyebrow ?? ''))
      setHeroDisplayTitle(String(p.hero_display_title ?? ''))
      setHeroDisplaySubtitle(String(p.hero_display_subtitle ?? ''))
      setHashtags(Array.isArray(p.hashtags) ? (p.hashtags as string[]) : [])
      setIsPublished(Boolean(p.is_published))
      setShowPhone(p.show_phone !== false)
      setShowKakao(Boolean(p.show_kakao))
      setKakaoLink(String(p.kakao_link ?? ''))
      setAllowConsultation(p.allow_consultation !== false)
      setProfileTheme(normalizeProfileTheme(p.profile_theme))
      setAddress({
        postalCode: String(p.office_postal_code ?? ''),
        roadAddress: String(p.office_road_address ?? ''),
        jibunAddress: '',
        addressDetail: String(p.office_address_detail ?? ''),
      })
      setPublicUrl(data.publicUrl)
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
    } finally {
      setLoading(false)
    }
  }, [applyBusinessCardFromServer, applyProfilePhotoFromServer, token])

  useEffect(() => {
    void load()
  }, [load])

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (!canAccessSelfProfilePage(user.role)) return <Navigate to="/dashboard" replace />

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
        title_label: titleLabel,
        hashtags,
        is_published: isPublished,
        show_phone: showPhone,
        show_kakao: showKakao,
        kakao_link: kakaoLink,
        allow_consultation: allowConsultation,
        profile_theme: profileTheme,
        office_postal_code: address.postalCode,
        office_road_address: address.roadAddress,
        office_address_detail: address.addressDetail,
        profile_photo_object_key: profilePhotoObjectKey ?? '',
        business_card_front_object_key: businessCardObjectKey ?? '',
        hero_display_eyebrow: heroDisplayEyebrow,
        hero_display_title: heroDisplayTitle,
        hero_display_subtitle: heroDisplaySubtitle,
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

  const copyLink = async () => {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setMessage('공개 링크를 복사했습니다.')
      if (slug) trackAdvisorPublicEvent(slug, ADVISOR_PUBLIC_EVENT.SHARE_CLICK)
    } catch {
      setMessage('링크 복사에 실패했습니다.')
    }
  }

  const shareLink = async () => {
    if (!publicUrl) return
    if (slug) trackAdvisorPublicEvent(slug, ADVISOR_PUBLIC_EVENT.SHARE_CLICK)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `${user.displayName ?? 'ONE FC'} 공개 프로필`,
          url: publicUrl,
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

  const gaLine = [ownerGaName, ownerTeamName].filter(Boolean).join(' · ')
  const officePreviewLine = [address.roadAddress, address.addressDetail].filter(Boolean).join(' ')

  const livePreviewModel = useMemo(() => {
    const phoneForPreview = showPhone ? ownerPhone || '01000000000' : ''
    return {
      displayName: ownerDisplayName || user.displayName || '',
      titleSuffix: titleLabel.trim() || 'FC',
      gaName: ownerGaName,
      teamName: ownerTeamName,
      heroDisplayEyebrow,
      heroDisplayTitle,
      heroDisplaySubtitle,
      profilePhotoUrl: profilePhotoPreviewUrl,
      primaryBadgeLabel: verificationBadgeLabel,
      affiliationLine: gaLine,
      officeLine: officePreviewLine,
      headline: headline.trim() || '한 줄 소개',
      publicTags: hashtags,
      phoneNumber: phoneForPreview,
      kakaoLink: showKakao ? kakaoLink : '',
      allowConsultation,
      bio,
      businessCardFrontUrl: businessCardPreviewUrl,
      gallery: gallery.map((g) => ({
        id: g.id,
        caption: g.caption,
        imageUrl: g.imageUrl,
      })),
      infoBlocks: buildAdvisorPublicInfoBlocks({
        gaName: ownerGaName,
        teamName: ownerTeamName,
        careerText,
        officeLine: officePreviewLine,
      }),
    }
  }, [
    allowConsultation,
    bio,
    businessCardPreviewUrl,
    careerText,
    gaLine,
    hashtags,
    headline,
    gallery,
    kakaoLink,
    officePreviewLine,
    ownerDisplayName,
    ownerGaName,
    ownerPhone,
    ownerTeamName,
    profilePhotoPreviewUrl,
    showKakao,
    showPhone,
    titleLabel,
    heroDisplayEyebrow,
    heroDisplayTitle,
    heroDisplaySubtitle,
    user.displayName,
    verificationBadgeLabel,
  ])

  const livePreviewPanel = (
    <aside className="pap-editor-layout__preview" aria-label="모바일 미리보기">
      <h2 className="pap-editor-live-preview__title">모바일 미리보기</h2>
      <div className="pap-editor-live-preview__frame pap-editor-live-preview__frame--phone">
        <div className="pap-editor-live-preview__scroll pap-theme-preview-shell pap-editor-live-preview__scroll--phone">
          <AdvisorPublicProfileView theme={profileTheme} model={livePreviewModel} variant="preview" />
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
          <button type="button" className="pap-btn pap-btn--secondary" onClick={() => setQrOpen(true)} disabled={!publicUrl}>QR</button>
          <button type="button" className="pap-btn pap-btn--secondary" onClick={() => void copyLink()} disabled={!publicUrl}>링크 복사</button>
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
        <p className="pap-editor-hint">비워 두면 계정·소속 정보로 자동 표시됩니다. 입력한 값이 Hero에 우선 적용됩니다.</p>
        <label>
          상단 라벨 / 브랜드 문구
          <input
            value={heroDisplayEyebrow}
            onChange={(e) => setHeroDisplayEyebrow(e.target.value)}
            placeholder="ONE FC"
            maxLength={80}
          />
        </label>
        <label>
          대표 표시 이름
          <input
            value={heroDisplayTitle}
            onChange={(e) => setHeroDisplayTitle(e.target.value)}
            placeholder="박성용 FC"
            maxLength={120}
          />
        </label>
        <label>
          보조 소속/직책 문구
          <input
            value={heroDisplaySubtitle}
            onChange={(e) => setHeroDisplaySubtitle(e.target.value)}
            placeholder="영진에셋 · 팀장"
            maxLength={200}
          />
        </label>

        <h2 className="pap-editor-section-title">기본 표시정보</h2>
        <p className="pap-affiliation"><strong>{ownerDisplayName || user.displayName}</strong>{gaLine ? ` · ${gaLine}` : ''}</p>
        <label>공개 주소 (영문·숫자·하이픈)<input value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
        <label>호칭 (자동 표시 fallback)<input value={titleLabel} onChange={(e) => setTitleLabel(e.target.value)} placeholder="FC" /></label>

          <h2 className="pap-editor-section-title">사무실 위치</h2>
          <AddressSearchField label="사무실 주소" value={address} onChange={setAddress} />

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

          <h2 className="pap-editor-section-title">연락 기능 설정</h2>
          <div className="pap-editor-toggle-row">
            <span>전화번호 공개</span>
            <input type="checkbox" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} />
          </div>
          <div className="pap-editor-toggle-row">
            <span>카카오톡 링크 공개</span>
            <input type="checkbox" checked={showKakao} onChange={(e) => setShowKakao(e.target.checked)} />
          </div>
          {showKakao ? <label>카카오톡 URL<input value={kakaoLink} onChange={(e) => setKakaoLink(e.target.value)} /></label> : null}
          <div className="pap-editor-toggle-row">
            <span>상담 신청 받기</span>
            <input type="checkbox" checked={allowConsultation} onChange={(e) => setAllowConsultation(e.target.checked)} />
          </div>

          <div className="pap-cta-row pap-cta-row--left" style={{ marginTop: 24 }}>
            <FormButton htmlType="submit" variant="primary" disabled={saving || mediaBusy}>
              {saving ? '저장 중…' : '저장'}
            </FormButton>
          </div>
          {publicUrl ? <p className="pap-affiliation"><code>{publicUrl}</code></p> : null}
          {message ? <p role="status">{message}</p> : null}
        </form>

        {livePreviewPanel}
      </div>

      <AdvisorProfileQr
        url={publicUrl}
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
              <AdvisorPublicProfileView theme={profileTheme} model={livePreviewModel} variant="preview" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default MyPublicProfilePage

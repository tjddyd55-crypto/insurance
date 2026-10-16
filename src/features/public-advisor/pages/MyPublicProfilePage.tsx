import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
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
import { AdvisorProfileQr } from '../components/AdvisorProfileQr'
import { RECOMMENDED_ADVISOR_HASHTAGS } from '../recommendedHashtags'
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
  const [hashtags, setHashtags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [showPhone, setShowPhone] = useState(true)
  const [showKakao, setShowKakao] = useState(false)
  const [kakaoLink, setKakaoLink] = useState('')
  const [allowConsultation, setAllowConsultation] = useState(true)
  const [address, setAddress] = useState<AddressSearchValue>(emptyAddress)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const [gallery, setGallery] = useState<OwnerGalleryItem[]>([])
  const [ownerGaName, setOwnerGaName] = useState('')
  const [ownerTeamName, setOwnerTeamName] = useState('')
  const [ownerDisplayName, setOwnerDisplayName] = useState('')
  const [qrOpen, setQrOpen] = useState(false)
  const [mediaBusy, setMediaBusy] = useState(false)
  const profileInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

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
      setHashtags(Array.isArray(p.hashtags) ? (p.hashtags as string[]) : [])
      setIsPublished(Boolean(p.is_published))
      setShowPhone(p.show_phone !== false)
      setShowKakao(Boolean(p.show_kakao))
      setKakaoLink(String(p.kakao_link ?? ''))
      setAllowConsultation(p.allow_consultation !== false)
      setAddress({
        postalCode: String(p.office_postal_code ?? ''),
        roadAddress: String(p.office_road_address ?? ''),
        jibunAddress: '',
        addressDetail: String(p.office_address_detail ?? ''),
      })
      setPublicUrl(data.publicUrl)
      setProfilePhotoUrl(data.profilePhotoUrl)
      setGallery(data.gallery)
      setOwnerDisplayName(data.user.displayName ?? '')
      setOwnerGaName(data.user.gaName ?? '')
      setOwnerTeamName(data.user.teamName ?? '')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (!canAccessSelfProfilePage(user)) return <Navigate to="/dashboard" replace />

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
        office_postal_code: address.postalCode,
        office_road_address: address.roadAddress,
        office_address_detail: address.addressDetail,
      })
      setMessage('저장되었습니다.')
      await load()
    } catch {
      setMessage('저장에 실패했습니다.')
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
      const objectKey = await uploadAdvisorImageFile(token, 'profile', file)
      await patchMyPublicProfile(token, { profile_photo_object_key: objectKey })
      setMessage('대표사진이 저장되었습니다.')
      await load()
    } catch {
      setMessage('대표사진 업로드에 실패했습니다.')
    } finally {
      setMediaBusy(false)
    }
  }

  const removeProfilePhoto = async () => {
    if (!token) return
    setMediaBusy(true)
    try {
      await patchMyPublicProfile(token, { profile_photo_object_key: '' })
      setMessage('대표사진을 삭제했습니다.')
      await load()
    } catch {
      setMessage('대표사진 삭제에 실패했습니다.')
    } finally {
      setMediaBusy(false)
    }
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
      const objectKey = await uploadAdvisorImageFile(token, 'gallery', file)
      await addAdvisorGalleryItem(token, objectKey)
      setMessage('사진이 추가되었습니다.')
      await load()
    } catch {
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

  return (
    <div className="page-shell pap-editor-page">
      <h1>내 공개 프로필</h1>
      <p>모바일 명함·QR·설계사 찾기에 동일한 페이지가 사용됩니다.</p>

      <section className="pap-editor-toolbar">
        <label className="pap-editor-toggle">
          <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
          공개 ON
        </label>
        <div className="pap-cta-row pap-cta-row--left">
          {slug ? (
            <Link className="pap-btn pap-btn--secondary" to={buildAdvisorPublicPath(slug)} target="_blank" rel="noopener noreferrer">
              내 페이지 보기
            </Link>
          ) : null}
          <button type="button" className="pap-btn pap-btn--secondary" onClick={() => void shareLink()}>공유</button>
          <button type="button" className="pap-btn pap-btn--secondary" onClick={() => setQrOpen(true)} disabled={!publicUrl}>QR</button>
          <button type="button" className="pap-btn pap-btn--secondary" onClick={() => void copyLink()} disabled={!publicUrl}>링크 복사</button>
        </div>
      </section>

      {loading ? <p>불러오는 중…</p> : null}

      <form className="pap-editor-form" onSubmit={(e) => void onSubmit(e)}>
        <h2 className="pap-editor-section-title">대표사진</h2>
        <div className="pap-editor-photo-row">
          {profilePhotoUrl ? (
            <img className="pap-editor-avatar" src={profilePhotoUrl} alt="대표사진 미리보기" />
          ) : (
            <div className="pap-editor-avatar pap-editor-avatar--empty" aria-hidden />
          )}
          <div className="pap-cta-row pap-cta-row--left">
            <button type="button" className="pap-btn pap-btn--secondary" disabled={mediaBusy} onClick={() => profileInputRef.current?.click()}>
              {profilePhotoUrl ? '변경' : '등록'}
            </button>
            {profilePhotoUrl ? (
              <button type="button" className="pap-btn pap-btn--secondary" disabled={mediaBusy} onClick={() => void removeProfilePhoto()}>
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

        <h2 className="pap-editor-section-title">기본정보</h2>
        <p className="pap-affiliation"><strong>{ownerDisplayName || user.displayName}</strong>{gaLine ? ` · ${gaLine}` : ''}</p>
        <label>공개 주소 (영문·숫자·하이픈)<input value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
        <label>호칭<input value={titleLabel} onChange={(e) => setTitleLabel(e.target.value)} placeholder="FC" /></label>

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

        <h2 className="pap-editor-section-title">나를 보여주는 사진 (최대 {GALLERY_MAX}장)</h2>
        <div className="pap-editor-gallery">
          {gallery.map((g, index) => (
            <div key={g.id} className="pap-editor-gallery-item">
              {g.imageUrl ? <img src={g.imageUrl} alt="" /> : null}
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

        <h2 className="pap-editor-section-title">연락 설정</h2>
        <label><input type="checkbox" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} /> 전화번호 공개</label>
        <label><input type="checkbox" checked={showKakao} onChange={(e) => setShowKakao(e.target.checked)} /> 카카오톡 링크 공개</label>
        {showKakao ? <label>카카오톡 URL<input value={kakaoLink} onChange={(e) => setKakaoLink(e.target.value)} /></label> : null}
        <label><input type="checkbox" checked={allowConsultation} onChange={(e) => setAllowConsultation(e.target.checked)} /> 상담 신청 받기</label>

        <div className="pap-cta-row pap-cta-row--left" style={{ marginTop: 24 }}>
          <FormButton type="submit" disabled={saving || mediaBusy}>{saving ? '저장 중…' : '저장'}</FormButton>
        </div>
        {publicUrl ? <p className="pap-affiliation"><code>{publicUrl}</code></p> : null}
        {message ? <p role="status">{message}</p> : null}
      </form>

      <AdvisorProfileQr
        url={publicUrl}
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        onView={() => {
          if (slug) trackAdvisorPublicEvent(slug, ADVISOR_PUBLIC_EVENT.QR_VIEW)
        }}
      />
    </div>
  )
}

export default MyPublicProfilePage

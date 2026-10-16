import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import { canAccessSelfProfilePage } from '../../auth/roleGuards'
import { Navigate } from 'react-router-dom'
import { AddressSearchField, type AddressSearchValue } from '../../../components/form'
import { fetchMyPublicProfile, patchMyPublicProfile } from '../api/publicAdvisorApi'
import { buildAdvisorPublicPath } from '../advisorPublicRoutes'
import '../public-advisor.css'

const emptyAddress: AddressSearchValue = {
  postalCode: '',
  roadAddress: '',
  jibunAddress: '',
  addressDetail: '',
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
  const [hashtagsRaw, setHashtagsRaw] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [showPhone, setShowPhone] = useState(true)
  const [showKakao, setShowKakao] = useState(false)
  const [kakaoLink, setKakaoLink] = useState('')
  const [allowConsultation, setAllowConsultation] = useState(true)
  const [address, setAddress] = useState<AddressSearchValue>(emptyAddress)

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
      setHashtagsRaw(Array.isArray(p.hashtags) ? (p.hashtags as string[]).join(', ') : '')
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
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (!canAccessSelfProfilePage(user)) return <Navigate to="/dashboard" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    setMessage('')
    try {
      const hashtags = hashtagsRaw
        .split(/[,\s#]+/)
        .map((t) => t.trim())
        .filter(Boolean)
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
    } catch {
      setMessage('링크 복사에 실패했습니다.')
    }
  }

  return (
    <div className="page-shell">
      <h1>내 공개 프로필</h1>
      <p>모바일 명함·QR·설계사 찾기에 동일한 페이지가 사용됩니다.</p>
      {loading ? <p>불러오는 중…</p> : null}
      <form className="pap-editor-form" onSubmit={(e) => void onSubmit(e)}>
        <label>
          <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
          프로필 공개
        </label>
        <label>공개 주소 (영문·숫자·하이픈)<input value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
        <label>호칭<input value={titleLabel} onChange={(e) => setTitleLabel(e.target.value)} placeholder="FC" /></label>
        <label>한 줄 소개<input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={200} /></label>
        <label>상세 자기소개<textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={8000} /></label>
        <label>경력/소속<textarea value={careerText} onChange={(e) => setCareerText(e.target.value)} maxLength={2000} /></label>
        <label>해시태그 (쉼표 구분, 최대 5개)<input value={hashtagsRaw} onChange={(e) => setHashtagsRaw(e.target.value)} /></label>
        <AddressSearchField label="사무실/지점 위치" value={address} onChange={setAddress} />
        <label><input type="checkbox" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} /> 전화번호 공개</label>
        <label><input type="checkbox" checked={showKakao} onChange={(e) => setShowKakao(e.target.checked)} /> 카카오톡 링크 공개</label>
        {showKakao ? <label>카카오톡 URL<input value={kakaoLink} onChange={(e) => setKakaoLink(e.target.value)} /></label> : null}
        <label><input type="checkbox" checked={allowConsultation} onChange={(e) => setAllowConsultation(e.target.checked)} /> 상담 신청 받기</label>
        <div className="pap-cta-row" style={{ justifyContent: 'flex-start' }}>
          <FormButton type="submit" disabled={saving}>{saving ? '저장 중…' : '저장'}</FormButton>
          <button type="button" className="pap-btn pap-btn--secondary" onClick={() => void copyLink()}>링크 복사</button>
          {slug ? (
            <Link className="pap-btn pap-btn--secondary" to={buildAdvisorPublicPath(slug)} target="_blank" rel="noopener noreferrer">
              미리보기
            </Link>
          ) : null}
        </div>
        {publicUrl ? <p><code>{publicUrl}</code></p> : null}
        {message ? <p role="status">{message}</p> : null}
      </form>
    </div>
  )
}

export default MyPublicProfilePage

import type { AdvisorProfileHeroProps } from './advisorProfileHeroTypes'

const noop = () => {}

export function buildHeroPreviewProps(input: {
  displayName: string
  titleSuffix: string
  profilePhotoUrl: string | null
  affiliationLine: string
  officeLine: string
  headline: string
  publicTags: string[]
  phoneNumber: string
  kakaoLink: string
  allowConsultation: boolean
  actionBarTheme: 'classic' | 'brand' | 'premium'
}): AdvisorProfileHeroProps {
  return {
    displayName: input.displayName || '홍길동',
    titleSuffix: input.titleSuffix || 'FC',
    profilePhotoUrl: input.profilePhotoUrl,
    primaryBadgeLabel: '✓ ONE FC 확인',
    affiliationLine: input.affiliationLine || 'ONE FC · 지점',
    officeLine: input.officeLine || '사무실 주소',
    headline: input.headline || '한 줄 소개가 여기에 표시됩니다.',
    publicTags: input.publicTags.length ? input.publicTags : ['보장분석', 'MDRT'],
    phoneNumber: input.phoneNumber,
    kakaoLink: input.kakaoLink,
    allowConsultation: input.allowConsultation,
    actionBarTheme: input.actionBarTheme,
    onPhoneClick: noop,
    onKakaoClick: noop,
    onConsultClick: noop,
    onShareClick: noop,
    hasBusinessCard: false,
    onBusinessCardClick: noop,
  }
}

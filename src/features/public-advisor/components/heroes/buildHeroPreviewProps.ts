import type { AdvisorProfileHeroProps } from './advisorProfileHeroTypes'
import { resolveAdvisorHeroDisplay } from '../../utils/resolveAdvisorHeroDisplay'

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
  const hero = resolveAdvisorHeroDisplay({
    heroDisplayEyebrow: 'ONE FC',
    heroDisplayTitle: '홍길동 FC',
    heroDisplaySubtitle: input.affiliationLine || '영진에셋 · 팀장',
  })
  return {
    displayName: input.displayName || '홍길동',
    titleSuffix: input.titleSuffix || 'FC',
    heroTitleLine: hero.heroTitleLine ?? '홍길동 FC',
    heroSubtitleLine: hero.heroSubtitleLine ?? '',
    heroEyebrowLine: hero.heroEyebrowLine,
    profilePhotoUrl: input.profilePhotoUrl,
    primaryBadgeLabel: hero.primaryBadgeLabel,
    affiliationLine: hero.heroSubtitleLine,
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

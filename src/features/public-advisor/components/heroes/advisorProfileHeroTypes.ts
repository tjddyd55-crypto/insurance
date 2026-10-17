export type AdvisorProfileHeroProps = {
  displayName: string
  titleSuffix: string
  heroTitleLine: string | null
  heroSubtitleLine: string | null
  heroEyebrowLine: string | null
  /** null=미설정, ''=사용자가 비움 */
  heroDisplayEyebrowRaw?: string | null
  profilePhotoUrl: string | null
  primaryBadgeLabel: string | null
  affiliationLine: string
  officeLine: string
  headline: string
  publicTags: string[]
  phoneNumber: string
  kakaoLink: string
  allowConsultation: boolean
  actionBarTheme: 'classic' | 'brand' | 'premium'
  onPhoneClick: () => void
  onKakaoClick: () => void
  onConsultClick: () => void
  onShareClick: () => void
  hasBusinessCard?: boolean
  onBusinessCardClick?: () => void
}

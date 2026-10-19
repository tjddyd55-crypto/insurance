import { AdvisorPublicImage } from '../AdvisorPublicImage'

export type AdvisorHeroPortraitVariant = 'classic' | 'brand' | 'premium'

const IMAGE_CLASS: Record<AdvisorHeroPortraitVariant, string> = {
  classic: 'pap-hero-photo',
  brand: 'pap-hero-brand__photo',
  premium: 'pap-hero-premium__photo',
}

type Props = {
  variant: AdvisorHeroPortraitVariant
  src: string | null | undefined
  alt: string
}

/**
 * Hero 공통 — 실제 대표사진이 들어가는 메인 슬롯.
 * fallback 시에도 명함용 portrait 자리가 보이도록 스타일링한다.
 */
export function AdvisorHeroPortraitSlot({ variant, src, alt }: Props) {
  return (
    <div className={`pap-hero-portrait-slot pap-hero-portrait-slot--${variant}`} data-hero-photo-slot={variant}>
      <AdvisorPublicImage className={IMAGE_CLASS[variant]} src={src} alt={alt} loading="eager" />
      <span className="pap-hero-portrait-slot__placeholder" aria-hidden>대표사진</span>
    </div>
  )
}

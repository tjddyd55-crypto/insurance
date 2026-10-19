import { AdvisorPublicImage } from '../AdvisorPublicImage'

export type AdvisorHeroPortraitVariant = 'classic' | 'brand' | 'premium'

const IMAGE_CLASS: Record<AdvisorHeroPortraitVariant, string> = {
  classic: 'pap-hero-photo',
  brand: 'pap-hero-brand__photo',
  premium: 'pap-hero-premium__photo',
}

/** CSS aspect-ratio 와 같은 비율. 숫자 자체는 크기가 아니라 로드 전 비율 예약이다. */
const INTRINSIC_SIZE: Record<AdvisorHeroPortraitVariant, { width: number; height: number }> = {
  classic: { width: 800, height: 1000 },
  brand: { width: 800, height: 800 },
  premium: { width: 800, height: 1200 },
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
      <AdvisorPublicImage
        className={IMAGE_CLASS[variant]}
        src={src}
        alt={alt}
        loading="eager"
        width={INTRINSIC_SIZE[variant].width}
        height={INTRINSIC_SIZE[variant].height}
      />
      <span className="pap-hero-portrait-slot__placeholder" aria-hidden>대표사진</span>
    </div>
  )
}

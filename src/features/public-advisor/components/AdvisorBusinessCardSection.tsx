import { AdvisorPublicImage } from './AdvisorPublicImage'

export type BusinessCardImageClick = {
  mediaType: 'businessCardFront'
  url: string
}

type Props = {
  frontUrl: string | null | undefined
  onImageClick: (payload: BusinessCardImageClick) => void
}

export function AdvisorBusinessCardSection({ frontUrl, onImageClick }: Props) {
  const hasFront = Boolean(frontUrl?.trim())
  if (!hasFront) return null

  return (
    <section className="pap-section pap-section--business-card pap-fc-card pap-section--business-card-clean">
      <button
        type="button"
        className="pap-business-card-tile"
        onClick={() => onImageClick({ mediaType: 'businessCardFront', url: frontUrl! })}
      >
        <AdvisorPublicImage className="pap-business-card-img" src={frontUrl} alt="명함" />
      </button>
    </section>
  )
}

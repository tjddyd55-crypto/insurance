import { AdvisorPublicImage } from './AdvisorPublicImage'

type Props = {
  frontUrl: string | null | undefined
  backUrl: string | null | undefined
  onImageClick: (url: string, label: string) => void
}

export function AdvisorBusinessCardSection({ frontUrl, backUrl, onImageClick }: Props) {
  const hasFront = Boolean(frontUrl?.trim())
  const hasBack = Boolean(backUrl?.trim())
  if (!hasFront && !hasBack) return null

  return (
    <section className="pap-section pap-section--business-card pap-fc-card">
      <h2>내 명함</h2>
      <div className={`pap-business-cards${hasFront && hasBack ? ' pap-business-cards--duo' : ''}`}>
        {hasFront ? (
          <button
            type="button"
            className="pap-business-card-tile"
            onClick={() => onImageClick(frontUrl!, '명함 앞면')}
          >
            <span className="pap-business-card-tile__label">앞면</span>
            <AdvisorPublicImage className="pap-business-card-img" src={frontUrl} alt="명함 앞면" />
          </button>
        ) : null}
        {hasBack ? (
          <button
            type="button"
            className="pap-business-card-tile"
            onClick={() => onImageClick(backUrl!, '명함 뒷면')}
          >
            <span className="pap-business-card-tile__label">뒷면</span>
            <AdvisorPublicImage className="pap-business-card-img" src={backUrl} alt="명함 뒷면" />
          </button>
        ) : null}
      </div>
      <p className="pap-business-card-hint">사진을 눌러 크게 볼 수 있습니다.</p>
    </section>
  )
}

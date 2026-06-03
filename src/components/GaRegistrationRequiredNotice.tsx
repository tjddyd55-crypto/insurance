import { FormButton } from './form'

type GaRegistrationRequiredNoticeProps = {
  title?: string
  onConfirm?: () => void
}

/**
 * GENERAL(공용) 소속 사용자가 GA 전용 공유 화면에 접근할 때 표시한다.
 */
export default function GaRegistrationRequiredNotice({
  title = '소속 GA 등록이 필요합니다.',
  onConfirm,
}: GaRegistrationRequiredNoticeProps) {
  return (
    <main className="page page--with-back ga-registration-required-page">
      <header className="page-header page-header--has-inline-back">
        <div className="page-header__title-row">
          <h1>{title}</h1>
        </div>
      </header>
      <section className="ga-registration-required-page__body dark-card">
        <p className="ga-registration-required-page__text">
          현재 계정은 공용 소속으로 등록되어 있어 GA 전용 소식지를 볼 수 없습니다.
          <br />
          소속 지점 또는 GA에서 서비스 사용을 원하시면 관리자에게 문의해 주세요.
        </p>
        {onConfirm ? (
          <FormButton type="button" variant="primary" onClick={onConfirm}>
            확인
          </FormButton>
        ) : null}
      </section>
    </main>
  )
}

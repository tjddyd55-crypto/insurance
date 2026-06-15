import { useNavigate } from 'react-router-dom'
import { FormButton } from '../../components/form'
import './public-account-restricted.css'

/**
 * 공용(GENERAL) 계정이 GA 전용 메뉴(신청서·전자서명·팀)에 접근할 때 표시한다.
 */
export default function PublicAccountRestrictedPage() {
  const navigate = useNavigate()

  return (
    <main className="page page--with-back public-account-restricted-page">
      <header className="page-header page-header--has-inline-back">
        <div className="page-header__title-row">
          <h1>안내</h1>
        </div>
      </header>
      <section
        className="public-account-restricted-page__card"
        aria-labelledby="public-account-restricted-title"
      >
        <h2 id="public-account-restricted-title" className="public-account-restricted-page__title">
          공용 계정에서는 사용할 수 없는 메뉴입니다.
        </h2>
        <p className="public-account-restricted-page__text">
          이 기능은 GA 소속 계정 전용 기능입니다.
          <br />
          공용 계정에서는 신청서, 전자서명, 팀 기능을 사용할 수 없습니다.
          <br />
          공용 소식지와 공용 게시판만 확인할 수 있습니다.
        </p>
        <div className="public-account-restricted-page__actions">
          <FormButton
            type="button"
            variant="secondary"
            onClick={() => navigate('/dashboard')}
          >
            대시보드로 돌아가기
          </FormButton>
          <FormButton
            type="button"
            variant="primary"
            onClick={() => navigate('/portal/newsletters')}
          >
            공용 소식지 보기
          </FormButton>
        </div>
      </section>
    </main>
  )
}

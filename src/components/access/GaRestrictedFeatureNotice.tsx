import { useNavigate } from 'react-router-dom'
import { FormButton } from '../form'
import {
  getGaRestrictedFeatureCopy,
  type GaRestrictedFeatureKey,
} from '../../features/auth/gaRestrictedFeatures'
import './ga-required-notice.css'

export type GaRestrictedFeatureNoticeProps = {
  feature: GaRestrictedFeatureKey
  /** 확인 클릭 시 이동 경로. 미지정 시 이전 화면 또는 대시보드 */
  confirmTo?: string
}

/**
 * GA 미소속 사용자가 GA 전용 기능에 접근했을 때 표시하는 공통 안내.
 */
export default function GaRestrictedFeatureNotice({
  feature,
  confirmTo,
}: GaRestrictedFeatureNoticeProps) {
  const navigate = useNavigate()
  const copy = getGaRestrictedFeatureCopy(feature)

  const handleConfirm = () => {
    if (confirmTo?.trim()) {
      navigate(confirmTo)
      return
    }
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/dashboard')
  }

  return (
    <main className="page page--with-back ga-required-notice-page">
      <header className="page-header page-header--has-inline-back">
        <div className="page-header__title-row">
          <h1>안내</h1>
        </div>
      </header>
      <section className="ga-required-notice-page__card" aria-labelledby="ga-restricted-notice-title">
        <h2 id="ga-restricted-notice-title" className="ga-required-notice-page__title">
          {copy.title}
        </h2>
        <p className="ga-required-notice-page__text">{copy.body}</p>
        <p className="ga-required-notice-page__text">{copy.helper}</p>
        <div className="ga-required-notice-page__actions">
          <FormButton type="button" variant="primary" onClick={handleConfirm}>
            확인
          </FormButton>
        </div>
      </section>
    </main>
  )
}

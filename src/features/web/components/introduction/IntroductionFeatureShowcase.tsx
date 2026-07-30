import { Link } from 'react-router-dom'
import {
  ANDROID_APP_DOWNLOAD_URL,
  DESKTOP_DOWNLOAD_URL,
  ONE_FC_APP_STORE_URL,
} from '../../constants/appInstallLinks'
import {
  introCustomerCapabilities,
  introFeatureImages,
  introMainHighlights,
  introPrivacyNote,
  introSupportCapabilities,
} from '../../config/introductionFeatureContent'
import { IntroFeatureImage } from './IntroFeatureImage'
import { ServiceInquiryLink } from './ServiceInquiryLink'

export function IntroductionFeatureShowcase() {
  return (
    <>
      <section className="intro-v2-section intro-v2-section--white intro-v2-features-summary">
        <div className="intro-v2-shell">
          <header className="intro-v2-title">
            <h2>보험 업무에 필요한 기능을 한 곳에</h2>
            <p>
              고객관리부터 상담, 파일, 청구, 신청서 작성, 고객앱 소통까지 반복되는 보험 업무를 더
              빠르고 체계적으로 관리할 수 있습니다.
            </p>
          </header>
          <ul className="intro-v2-highlight-list" aria-label="주요 기능">
            {introMainHighlights.map((label) => (
              <li key={label} className="intro-v2-highlight-chip">{label}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="intro-v2-section intro-v2-section--soft intro-v2-features-overview">
        <div className="intro-v2-shell">
          <IntroFeatureImage src={introFeatureImages.overview.src} alt={introFeatureImages.overview.alt} />
          <p className="intro-v2-privacy-note">{introPrivacyNote}</p>
        </div>
      </section>

      <section className="intro-v2-section intro-v2-section--white">
        <div className="intro-v2-shell">
          <header className="intro-v2-title">
            <h2>고객관리부터 청구관리까지 한 번에</h2>
            <p>
              고객 정보, 상담 내역, 개인 파일, 청구 요청, 지역별 고객 관리까지 하나의 흐름으로
              연결해 관리할 수 있습니다.
            </p>
          </header>
          <IntroFeatureImage
            src={introFeatureImages.customer.src}
            alt={introFeatureImages.customer.alt}
          />
          <div className="intro-v2-capability-grid">
            {introCustomerCapabilities.map((item, index) => (
              <article key={item.title} className="intro-v2-capability-card">
                <span className="intro-v2-capability-card__index" aria-hidden="true">
                  {index + 1}
                </span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="intro-v2-section intro-v2-section--paper">
        <div className="intro-v2-shell">
          <header className="intro-v2-title">
            <h2>반복 업무는 줄이고 고객 응대는 더 빠르게</h2>
            <p>
              소식지 공유, 팀관리, PDF 신청서 자동화, 고객앱 메시지 기능으로 업무 시간을 줄이고
              고객 응대 속도를 높일 수 있습니다.
            </p>
          </header>
          <IntroFeatureImage
            src={introFeatureImages.support.src}
            alt={introFeatureImages.support.alt}
          />
          <div className="intro-v2-capability-grid intro-v2-capability-grid--support">
            {introSupportCapabilities.map((item, index) => (
              <article key={item.title} className="intro-v2-capability-card">
                <span className="intro-v2-capability-card__index" aria-hidden="true">
                  {index + 6}
                </span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="intro-v2-inline-cta" aria-label="서비스 문의">
        <div className="intro-v2-shell intro-v2-inline-cta__inner">
          <p className="intro-v2-inline-cta__text">이런 기능이 필요하셨다면, 지금 바로 사용해보세요</p>
          <ServiceInquiryLink variant="white" className="intro-v2-inline-cta__btn" />
        </div>
      </section>
    </>
  )
}

export function IntroductionFinalCta() {
  return (
    <section className="intro-v2-cta intro-v2-cta--features">
      <div className="intro-v2-shell intro-v2-cta__inner">
        <h2>보험 업무를 더 편하게 관리해보세요</h2>
        <p>
          고객관리, 청구관리, 서류 작성, 고객 소통까지 필요한 기능을 한 곳에서 사용할 수 있습니다.
        </p>
        <div className="intro-v2-cta__actions">
          <ServiceInquiryLink variant="cta-white" />
          <a
            className="intro-v2-cta__action intro-v2-cta__action--white"
            href={DESKTOP_DOWNLOAD_URL}
            download
          >
            PC 프로그램 다운로드
          </a>
          <a
            className="intro-v2-cta__action intro-v2-cta__action--white"
            href={ANDROID_APP_DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            안드로이드 다운로드
          </a>
          <a
            className="intro-v2-cta__action intro-v2-cta__action--white"
            href={ONE_FC_APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            아이폰 다운로드
          </a>
          <Link className="intro-v2-cta__action intro-v2-cta__action--outline" to="/introduction/install">
            설치 안내 보기
          </Link>
        </div>
      </div>
    </section>
  )
}

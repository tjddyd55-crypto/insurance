import { Link } from 'react-router-dom'
import { DESKTOP_DOWNLOAD_URL } from '../constants/appInstallLinks'
import { OneFcMobileInstallOptions } from '../components/OneFcMobileInstallOptions'
import { BusinessInfoFooter } from '../components/BusinessInfoFooter'
import {
  IntroductionFeatureShowcase,
  IntroductionFinalCta,
} from '../components/introduction/IntroductionFeatureShowcase'

export function IntroductionPage() {
  const structureItems = [
    { title: '원수사', points: ['상품 정보', '공지', '시책공지'] },
    { title: 'GA', points: ['공지 관리', '자료 공유'] },
    { title: 'FC', points: ['고객관리', '상담', '청구', '클라우드서비스'], accent: true },
    { title: '고객', points: ['자료 확인', '소식지 수신', '청구요청'] },
  ] as const

  const flowItems = [
    { title: 'GA -> FC', desc: '공지 등록 -> 자동 전달' },
    { title: 'FC -> 고객', desc: '고객 등록 -> 상담 -> 파일 -> 청구' },
    { title: 'FC -> 고객', desc: '소식지 작성 -> 자동 전달' },
  ] as const

  const valueItems = [
    { title: '시간 절약', desc: '엑셀 / 카톡 / 파일 관리 제거' },
    { title: '실수 감소', desc: '자동화로 누락 방지' },
    { title: '매출 집중', desc: '고객 상담에 집중' },
  ] as const

  return (
    <main className="intro-v2">
      <section className="intro-v2-hero">
        <div className="intro-v2-hero__bg" />
        <div className="intro-v2-shell intro-v2-hero__inner">
          <div className="intro-v2-logo">FA-OA</div>
          <h1>보험 업무, 이제 하나로 끝.</h1>
          <p>고객관리 · 상담 · 파일 · 청구 · 소식지까지 모든 업무를 하나로 통합</p>
          <div className="intro-v2-badges">
            <span>FC 전용</span>
            <span>올인원 시스템</span>
            <span>자동화 플랫폼</span>
          </div>
          <div className="intro-v2-hero__download-actions">
            <a className="intro-v2-btn intro-v2-btn--white intro-v2-hero__pc-download" href={DESKTOP_DOWNLOAD_URL} download>
              PC 프로그램 다운로드
            </a>
            <OneFcMobileInstallOptions variant="intro-hero" />
            <Link className="intro-v2-btn intro-v2-btn--primary" to="/introduction/install">
              설치 안내 보기
            </Link>
          </div>
        </div>
      </section>

      <IntroductionFeatureShowcase />

      <section className="intro-v2-section intro-v2-section--white">
        <div className="intro-v2-shell">
          <header className="intro-v2-title">
            <h2>핵심 구조</h2>
            <p>정보가 자연스럽게 흐르는 통합 시스템</p>
          </header>
          <div className="intro-v2-structure">
            {structureItems.map((item, index) => (
              <div key={item.title} className="intro-v2-structure__group">
                <article className={`intro-v2-structure-card${item.accent ? ' is-accent' : ''}`}>
                  <h3>{item.title}</h3>
                  <ul>
                    {item.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </article>
                {index < structureItems.length - 1 ? <div className="intro-v2-arrow">↓</div> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="intro-v2-section intro-v2-section--paper">
        <div className="intro-v2-shell">
          <header className="intro-v2-title">
            <h2>실제 사용 흐름</h2>
            <p>업무가 자동으로 연결됩니다</p>
          </header>
          <div className="intro-v2-flow-grid">
            {flowItems.map((item) => (
              <article key={`${item.title}-${item.desc}`} className="intro-v2-flow-card">
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="intro-v2-section intro-v2-section--white">
        <div className="intro-v2-shell">
          <header className="intro-v2-title">
            <h2>핵심 가치</h2>
            <p>FA-OA가 제공하는 차별화된 가치</p>
          </header>
          <div className="intro-v2-value-grid">
            {valueItems.map((item) => (
              <article key={item.title} className="intro-v2-value-card">
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <IntroductionFinalCta />
      <BusinessInfoFooter />
    </main>
  )
}

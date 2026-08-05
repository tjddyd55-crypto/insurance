import type { ReactNode } from 'react'
import {
  INTRO_BRANCH,
  INTRO_COMPARISON,
  INTRO_CONTACT,
  INTRO_CUSTOMER,
  INTRO_DOWNLOAD,
  INTRO_FC,
  INTRO_FINAL,
  INTRO_HERO,
  INTRO_INSURER,
  INTRO_INTEGRATION,
  INTRO_PHONE_DISPLAY,
  INTRO_PROBLEM,
  INTRO_SOLUTION,
  INTRO_STRUCTURE,
  INTRO_SYNC,
  INTRO_TEL_HREF,
} from '../../../config/introductionLandingContent'
import IntroContactForm from './IntroContactForm'
import { INTRO_BRAND_NAME } from './introLandingConstants'
import {
  IntroChipList,
  IntroSectionHeading,
  IntroSectionLink,
  IntroSectionShell,
} from './introLandingPrimitives'

/**
 * ONE FC 랜딩 본문 — 14개 섹션을 형제로 나열한다.
 *
 * 구성 원칙:
 *   - 카피/링크는 전부 `introductionLandingContent.ts` 에서만 온다. 이 파일에는 문구를 두지 않는다.
 *     (예외: 표 헤더 라벨처럼 마크업 구조에 종속된 최소 라벨은 상단 상수로 모아둔다.)
 *   - 섹션 하나 = 함수 하나. 섹션 추가/삭제는 아래 `IntroLandingSections` 나열만 수정한다.
 *   - 스크롤 이동은 상위(useIntroductionLandingState)가 주는 `goToSection` 만 사용한다.
 */

const SECTION_LABEL = {
  comparisonBefore: '기존 방식',
  comparisonAfter: INTRO_BRAND_NAME,
} as const

const ARROW_GLYPH = '→'

/** CTA 가 가리키는 섹션. 문구가 아니라 이동 대상이므로 이 파일이 소유한다. */
const CTA_TARGET = {
  download: 'download',
  solution: 'solution',
  contact: 'contact',
} as const

type IntroSectionProps = {
  goToSection: (id: string) => void
}

type IntroLandingSectionsProps = IntroSectionProps & {
  /** 문의 폼 주입 지점. 미지정 시 기본(클라이언트 전용) 폼을 사용한다. */
  contactForm?: ReactNode
}

function IntroFlowArrow() {
  return (
    <span className="intro-landing-arrow" aria-hidden="true">
      {ARROW_GLYPH}
    </span>
  )
}

function HeroSection({ goToSection }: IntroSectionProps) {
  return (
    <IntroSectionShell id="overview" tone="hero">
      <IntroSectionHeading
        sectionId="overview"
        eyebrow={INTRO_HERO.eyebrow}
        title={INTRO_HERO.title}
        body={INTRO_HERO.body}
        asPageTitle
      />
      <div className="intro-landing-hero__actions">
        <IntroSectionLink
          sectionId={CTA_TARGET.download}
          className="intro-landing-btn intro-landing-btn--primary"
          onNavigate={goToSection}
        >
          {INTRO_HERO.primaryCta}
        </IntroSectionLink>
        <IntroSectionLink
          sectionId={CTA_TARGET.solution}
          className="intro-landing-btn intro-landing-btn--secondary"
          onNavigate={goToSection}
        >
          {INTRO_HERO.secondaryCta}
        </IntroSectionLink>
      </div>
      <p className="intro-landing-hero__helper">
        <strong>{INTRO_HERO.helperStrong}</strong>
        <span>{INTRO_HERO.helperSub}</span>
      </p>
      <IntroChipList
        items={INTRO_HERO.diagramSources}
        label="ONE FC로 통합되는 업무"
        className="intro-landing-hero__sources"
      />
    </IntroSectionShell>
  )
}

function ProblemSection() {
  return (
    <IntroSectionShell id="problem" tone="soft">
      <IntroSectionHeading
        sectionId="problem"
        eyebrow={INTRO_PROBLEM.eyebrow}
        title={INTRO_PROBLEM.title}
        body={INTRO_PROBLEM.body}
      />
      <div className="intro-landing-problem">
        <IntroChipList
          items={INTRO_PROBLEM.tools}
          label="흩어져 있는 업무 도구"
          className="intro-landing-problem__tools"
        />
        <IntroFlowArrow />
        <IntroChipList
          items={INTRO_PROBLEM.results}
          label="그 결과 생기는 문제"
          className="intro-landing-problem__results"
        />
      </div>
    </IntroSectionShell>
  )
}

function IntegrationSection() {
  return (
    <IntroSectionShell id="integration" tone="light">
      <IntroSectionHeading
        sectionId="integration"
        eyebrow={INTRO_INTEGRATION.eyebrow}
        title={INTRO_INTEGRATION.title}
        body={INTRO_INTEGRATION.body}
      />
      <div className="intro-landing-integration">
        <IntroChipList
          items={INTRO_INTEGRATION.works}
          label="통합되는 업무"
          className="intro-landing-integration__works"
        />
        <p className="intro-landing-integration__hub">{INTRO_BRAND_NAME}</p>
        <ul className="intro-landing-integration__participants" aria-label="연결되는 참여자">
          {INTRO_INTEGRATION.participants.map((participant) => (
            <li key={participant.title} className="intro-landing-integration__participant">
              <strong>{participant.title}</strong>
              <span>{participant.desc}</span>
            </li>
          ))}
        </ul>
      </div>
    </IntroSectionShell>
  )
}

function FcSection() {
  return (
    <IntroSectionShell id="fc" tone="light">
      <IntroSectionHeading
        sectionId="fc"
        eyebrow={INTRO_FC.eyebrow}
        title={INTRO_FC.title}
        body={INTRO_FC.body}
      />
      <IntroChipList
        items={INTRO_FC.features}
        label="FC 업무 기능"
        className="intro-landing-fc__features"
      />
      <p className="intro-landing-highlight">{INTRO_FC.highlight}</p>
    </IntroSectionShell>
  )
}

function BranchSection() {
  return (
    <IntroSectionShell id="branch" tone="soft">
      <IntroSectionHeading
        sectionId="branch"
        eyebrow={INTRO_BRANCH.eyebrow}
        title={INTRO_BRANCH.title}
      />
      <div className="intro-landing-beforeafter">
        <article className="intro-landing-beforeafter__col intro-landing-beforeafter__col--before">
          <h3 className="intro-landing-beforeafter__title">{SECTION_LABEL.comparisonBefore}</h3>
          <ul className="intro-landing-beforeafter__list">
            {INTRO_BRANCH.before.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <IntroFlowArrow />
        <article className="intro-landing-beforeafter__col intro-landing-beforeafter__col--after">
          <h3 className="intro-landing-beforeafter__title">{SECTION_LABEL.comparisonAfter}</h3>
          <ul className="intro-landing-beforeafter__list">
            {INTRO_BRANCH.after.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>
      <p className="intro-landing-highlight">{INTRO_BRANCH.highlight}</p>
    </IntroSectionShell>
  )
}

function InsurerSection() {
  const lastIndex = INTRO_INSURER.flow.length - 1
  return (
    <IntroSectionShell id="insurer" tone="light">
      <IntroSectionHeading
        sectionId="insurer"
        eyebrow={INTRO_INSURER.eyebrow}
        title={INTRO_INSURER.title}
      />
      <ol className="intro-landing-flow" aria-label="원수사 소식 전달 흐름">
        {INTRO_INSURER.flow.map((step, index) => (
          <li key={step} className="intro-landing-flow__node">
            <span className="intro-landing-flow__label">{step}</span>
            {index < lastIndex ? <IntroFlowArrow /> : null}
          </li>
        ))}
      </ol>
      <IntroChipList
        items={INTRO_INSURER.uses}
        label="소식지 활용"
        className="intro-landing-insurer__uses"
      />
      <p className="intro-landing-note">{INTRO_INSURER.note}</p>
    </IntroSectionShell>
  )
}

function CustomerSection() {
  return (
    <IntroSectionShell id="customer" tone="soft">
      <IntroSectionHeading
        sectionId="customer"
        eyebrow={INTRO_CUSTOMER.eyebrow}
        title={INTRO_CUSTOMER.title}
      />
      <ol className="intro-landing-steps" aria-label="고객 요청 처리 순서">
        {INTRO_CUSTOMER.steps.map((step, index) => (
          <li key={step} className="intro-landing-steps__item">
            <span className="intro-landing-steps__num" aria-hidden="true">
              {index + 1}
            </span>
            <span className="intro-landing-steps__text">{step}</span>
          </li>
        ))}
      </ol>
      <p className="intro-landing-note">{INTRO_CUSTOMER.note}</p>
    </IntroSectionShell>
  )
}

function StructureSection() {
  const lastIndex = INTRO_INTEGRATION.participants.length - 1
  return (
    <IntroSectionShell id="structure" tone="light">
      <IntroSectionHeading
        sectionId="structure"
        eyebrow={INTRO_STRUCTURE.eyebrow}
        title={INTRO_STRUCTURE.title}
        body={INTRO_STRUCTURE.body}
      />
      <div className="intro-landing-structure">
        <p className="intro-landing-structure__hub">{INTRO_BRAND_NAME}</p>
        <ol className="intro-landing-structure__flow" aria-label="참여자 연결 구조">
          {INTRO_INTEGRATION.participants.map((participant, index) => (
            <li key={participant.title} className="intro-landing-structure__node">
              <strong className="intro-landing-structure__node-title">{participant.title}</strong>
              <span className="intro-landing-structure__node-desc">{participant.desc}</span>
              {index < lastIndex ? <IntroFlowArrow /> : null}
            </li>
          ))}
        </ol>
      </div>
    </IntroSectionShell>
  )
}

function ComparisonSection() {
  return (
    <IntroSectionShell id="comparison" tone="soft">
      <IntroSectionHeading
        sectionId="comparison"
        eyebrow={INTRO_COMPARISON.eyebrow}
        title={INTRO_COMPARISON.title}
      />
      {/* PC 는 표, 모바일은 카드. 노출은 CSS 가 결정하며 display:none 이면 접근성 트리에서도 빠진다. */}
      <div className="intro-landing-comparison__pc">
        <table className="intro-landing-comparison__table">
          <thead>
            <tr>
              <th scope="col">{SECTION_LABEL.comparisonBefore}</th>
              <th scope="col">{SECTION_LABEL.comparisonAfter}</th>
            </tr>
          </thead>
          <tbody>
            {INTRO_COMPARISON.rows.map((row) => (
              <tr key={row.before}>
                <td>{row.before}</td>
                <td>{row.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="intro-landing-comparison__mobile">
        {INTRO_COMPARISON.rows.map((row) => (
          <li key={row.before} className="intro-landing-comparison__card">
            <p className="intro-landing-comparison__row">
              <span className="intro-landing-comparison__key">{SECTION_LABEL.comparisonBefore}</span>
              <span className="intro-landing-comparison__value">{row.before}</span>
            </p>
            <p className="intro-landing-comparison__row intro-landing-comparison__row--after">
              <span className="intro-landing-comparison__key">{SECTION_LABEL.comparisonAfter}</span>
              <span className="intro-landing-comparison__value">{row.after}</span>
            </p>
          </li>
        ))}
      </ul>
    </IntroSectionShell>
  )
}

function SolutionSection() {
  return (
    <IntroSectionShell id="solution" tone="light">
      <IntroSectionHeading
        sectionId="solution"
        eyebrow={INTRO_SOLUTION.eyebrow}
        title={INTRO_SOLUTION.title}
      />
      <div className="intro-landing-solution">
        {INTRO_SOLUTION.groups.map((group) => (
          <article key={group.title} className="intro-landing-solution__group">
            <h3 className="intro-landing-solution__group-title">{group.title}</h3>
            <ul className="intro-landing-solution__items">
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </IntroSectionShell>
  )
}

function SyncSection() {
  return (
    <IntroSectionShell id="sync" tone="soft">
      <IntroSectionHeading
        sectionId="sync"
        eyebrow={INTRO_SYNC.eyebrow}
        title={INTRO_SYNC.title}
        body={INTRO_SYNC.body}
      />
      <div className="intro-landing-sync">
        {INTRO_SYNC.devices.map((device) => (
          <article key={device.title} className="intro-landing-sync__card">
            <h3 className="intro-landing-sync__card-title">{device.title}</h3>
            <p className="intro-landing-sync__card-desc">{device.desc}</p>
          </article>
        ))}
      </div>
    </IntroSectionShell>
  )
}

type IntroDownloadCard = (typeof INTRO_DOWNLOAD.cards)[number]

function IntroDownloadCardLink({ card }: { card: IntroDownloadCard }) {
  const className = 'intro-landing-btn intro-landing-btn--primary intro-landing-btn--block'

  if (card.external) {
    return (
      <a className={className} href={card.href} target="_blank" rel="noopener noreferrer">
        {card.button}
      </a>
    )
  }

  const downloadable = 'download' in card && card.download === true
  return (
    <a className={className} href={card.href} {...(downloadable ? { download: true } : {})}>
      {card.button}
    </a>
  )
}

function DownloadSection() {
  return (
    <IntroSectionShell id="download" tone="light">
      <IntroSectionHeading
        sectionId="download"
        eyebrow={INTRO_DOWNLOAD.eyebrow}
        title={INTRO_DOWNLOAD.title}
        body={INTRO_DOWNLOAD.body}
      />
      <div className="intro-landing-download__steps">
        <h3 className="intro-landing-download__steps-title">{INTRO_DOWNLOAD.stepsTitle}</h3>
        <ol className="intro-landing-steps">
          {INTRO_DOWNLOAD.steps.map((step) => (
            <li key={step.num} className="intro-landing-steps__item">
              <span className="intro-landing-steps__num" aria-hidden="true">
                {step.num}
              </span>
              <span className="intro-landing-steps__text">
                <strong>{step.title}</strong>
                <span>{step.desc}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="intro-landing-note">{INTRO_DOWNLOAD.accountNote}</p>
      </div>
      <div className="intro-landing-download__cards">
        {INTRO_DOWNLOAD.cards.map((card) => (
          <article key={card.id} className="intro-landing-download__card">
            <p className="intro-landing-download__card-eyebrow">{card.eyebrow}</p>
            <h3 className="intro-landing-download__card-title">{card.title}</h3>
            <p className="intro-landing-download__card-desc">{card.desc}</p>
            <IntroDownloadCardLink card={card} />
            <p className="intro-landing-download__card-note">{card.note}</p>
          </article>
        ))}
      </div>
    </IntroSectionShell>
  )
}

function FinalCtaSection({ goToSection }: IntroSectionProps) {
  return (
    <IntroSectionShell id="start" tone="accent">
      <IntroSectionHeading sectionId="start" title={INTRO_FINAL.title} body={INTRO_FINAL.body} />
      <div className="intro-landing-final__actions">
        <IntroSectionLink
          sectionId={CTA_TARGET.download}
          className="intro-landing-btn intro-landing-btn--primary"
          onNavigate={goToSection}
        >
          {INTRO_FINAL.primaryCta}
        </IntroSectionLink>
        <IntroSectionLink
          sectionId={CTA_TARGET.contact}
          className="intro-landing-btn intro-landing-btn--secondary"
          onNavigate={goToSection}
        >
          {INTRO_FINAL.secondaryCta}
        </IntroSectionLink>
      </div>
    </IntroSectionShell>
  )
}

function ContactSection({ goToSection, contactForm }: IntroLandingSectionsProps) {
  return (
    <IntroSectionShell id="contact" tone="soft">
      <IntroSectionHeading
        sectionId="contact"
        eyebrow={INTRO_CONTACT.eyebrow}
        title={INTRO_CONTACT.title}
        body={INTRO_CONTACT.body}
      />
      <div className="intro-landing-contact">
        <aside className="intro-landing-contact__aside">
          <article className="intro-landing-contact__phone">
            <h3 className="intro-landing-contact__phone-title">{INTRO_CONTACT.phoneTitle}</h3>
            <a className="intro-landing-contact__phone-number" href={INTRO_TEL_HREF}>
              {INTRO_PHONE_DISPLAY}
            </a>
            <p className="intro-landing-contact__phone-hours">{INTRO_CONTACT.phoneHours}</p>
          </article>

          <article className="intro-landing-contact__topics">
            <h3 className="intro-landing-contact__topics-title">{INTRO_CONTACT.topicsTitle}</h3>
            <ul className="intro-landing-contact__topics-list">
              {INTRO_CONTACT.topics.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          </article>

          <p className="intro-landing-contact__self-serve">
            <span>{INTRO_CONTACT.selfServeTitle}</span>
            <IntroSectionLink
              sectionId={CTA_TARGET.download}
              className="intro-landing-btn intro-landing-btn--secondary intro-landing-btn--sm"
              onNavigate={goToSection}
            >
              {INTRO_CONTACT.selfServeLink}
            </IntroSectionLink>
          </p>
        </aside>

        <div className="intro-landing-contact__form">
          <h3 className="intro-landing-contact__form-title">{INTRO_CONTACT.formTitle}</h3>
          {contactForm ?? <IntroContactForm />}
        </div>
      </div>
    </IntroSectionShell>
  )
}

export function IntroLandingSections({ goToSection, contactForm }: IntroLandingSectionsProps) {
  return (
    <>
      <HeroSection goToSection={goToSection} />
      <ProblemSection />
      <IntegrationSection />
      <FcSection />
      <BranchSection />
      <InsurerSection />
      <CustomerSection />
      <StructureSection />
      <ComparisonSection />
      <SolutionSection />
      <SyncSection />
      <DownloadSection />
      <FinalCtaSection goToSection={goToSection} />
      <ContactSection goToSection={goToSection} contactForm={contactForm} />
    </>
  )
}

export default IntroLandingSections

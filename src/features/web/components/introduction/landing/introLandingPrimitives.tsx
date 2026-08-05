import { Fragment, type MouseEvent, type ReactNode } from 'react'
import type { IntroSectionId } from '../../../config/introductionLandingContent'
import { introSectionTitleId, type IntroSectionTone } from './introLandingConstants'

/**
 * ONE FC 랜딩 전용 프레젠테이션 프리미티브.
 *
 * 섹션 파일이 14개 섹션을 다루는 동안 마크업 골격이 매번 복제되는 것을 막는
 * 최소 단위다. 스타일은 전부 CSS(`intro-landing-*`)가 담당하고 이 파일은
 * 구조·접근성 속성만 책임진다. 컴포넌트만 export 한다(상수는 introLandingConstants).
 */

type IntroSectionShellProps = {
  /** `INTRO_SECTION_IDS` 에 정의된 id 만 허용해 nav 앵커와 어긋나지 않게 한다. */
  id: IntroSectionId
  tone: IntroSectionTone
  children: ReactNode
}

/** 모든 랜딩 섹션의 공통 골격: `<section>` + 내부 `.intro-landing-shell`. */
export function IntroSectionShell({ id, tone, children }: IntroSectionShellProps) {
  return (
    <section
      id={id}
      className={`intro-landing-section intro-landing-section--${tone}`}
      aria-labelledby={introSectionTitleId(id)}
    >
      <div className="intro-landing-shell">{children}</div>
    </section>
  )
}

type IntroSectionHeadingProps = {
  sectionId: string
  eyebrow?: string
  title: string
  body?: string
  /** hero 처럼 문서상 h1 이 필요한 섹션만 true. */
  asPageTitle?: boolean
}

/** 섹션 상단 공통 헤딩(eyebrow / 제목 / 본문). */
export function IntroSectionHeading({
  sectionId,
  eyebrow,
  title,
  body,
  asPageTitle = false,
}: IntroSectionHeadingProps) {
  const titleId = introSectionTitleId(sectionId)
  const titleNode = <IntroMultilineText text={title} />

  return (
    <header className="intro-landing-heading">
      {eyebrow ? <p className="intro-landing-heading__eyebrow">{eyebrow}</p> : null}
      {asPageTitle ? (
        <h1 id={titleId} className="intro-landing-heading__title">
          {titleNode}
        </h1>
      ) : (
        <h2 id={titleId} className="intro-landing-heading__title">
          {titleNode}
        </h2>
      )}
      {body ? <p className="intro-landing-heading__body">{body}</p> : null}
    </header>
  )
}

/**
 * 카피에 포함된 `\n` 을 줄바꿈으로 렌더한다.
 * CSS `white-space: pre-line` 대신 마크업으로 처리해, 스타일이 바뀌어도
 * 의도한 줄바꿈이 유지되도록 한다.
 */
export function IntroMultilineText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, index) => (
        <Fragment key={`${index}-${line}`}>
          {index > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </>
  )
}

type IntroSectionLinkProps = {
  sectionId: string
  className: string
  children: ReactNode
  onNavigate: (sectionId: string) => void
  active?: boolean
}

/**
 * 같은 문서 안의 섹션으로 이동하는 링크.
 *
 * `<button>` 이 아니라 `<a href="#id">` 인 이유:
 *   - 문서 내 이동은 앵커가 semantic 하게 정확하다(새 탭/URL 공유/JS 실패 시 폴백).
 *   - 스크롤 애니메이션·메뉴 닫기는 훅이 담당하므로 기본 동작만 막고 위임한다.
 * 헤더·모바일 메뉴·CTA 가 모두 이 컴포넌트를 쓰기 때문에 이동 동작이 한곳에 모인다.
 */
export function IntroSectionLink({
  sectionId,
  className,
  children,
  onNavigate,
  active = false,
}: IntroSectionLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    onNavigate(sectionId)
  }

  return (
    <a
      href={`#${sectionId}`}
      className={className}
      aria-current={active ? 'true' : undefined}
      onClick={handleClick}
    >
      {children}
    </a>
  )
}

type IntroChipListProps = {
  items: readonly string[]
  label: string
  className?: string
}

/** 라벨이 붙은 단순 칩 목록(문제/기능/활용처 등에서 반복 사용). */
export function IntroChipList({ items, label, className = '' }: IntroChipListProps) {
  return (
    <ul className={['intro-landing-chips', className].filter(Boolean).join(' ')} aria-label={label}>
      {items.map((item) => (
        <li key={item} className="intro-landing-chip">
          {item}
        </li>
      ))}
    </ul>
  )
}

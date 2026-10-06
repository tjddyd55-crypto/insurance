const TITLE_LABEL_SELECTOR = '.cs-axis-event__title-axis .cs-axis-event__label'
const BADGE_LABEL_SELECTOR = '.coverage-simulator-badge__label'

/**
 * html2canvas scale 2에서 배지 11px / 항목명 14px 라인박스를 맞춘 캡처 전용 값.
 * 문서 헤더(시나리오·고객/작성일)에는 적용하지 않는다. 줄 높이가 달라 글자가 잘린다.
 */
export const COVERAGE_PDF_BADGE_RASTER_SHIFT_PX = '-6px'
export const COVERAGE_PDF_TITLE_RASTER_SHIFT_PX = '-8px'

const COVERAGE_PDF_INLINE_HEAD_STYLES: Partial<CSSStyleDeclaration> = {
  display: 'block',
  position: 'relative',
  height: '28px',
  minHeight: '28px',
  padding: '0',
  paddingBlock: '0',
  overflow: 'visible',
  boxSizing: 'border-box',
}

const COVERAGE_PDF_INLINE_BADGE_WRAP_STYLES: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  left: '0',
  top: '3px',
  display: 'block',
  width: 'auto',
  height: '22px',
  margin: '0',
  flex: 'none',
  overflow: 'visible',
}

const COVERAGE_PDF_INLINE_TITLE_AXIS_STYLES: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  left: '0',
  right: '0',
  top: '3px',
  height: '22px',
  margin: '0',
  transform: 'none',
  textAlign: 'center',
  width: 'auto',
  maxWidth: 'none',
  pointerEvents: 'none',
}

export const COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES: Partial<CSSStyleDeclaration> = {
  display: 'inline-block',
  position: 'relative',
  top: '0',
  overflow: 'visible',
  textOverflow: 'clip',
  whiteSpace: 'normal',
  wordBreak: 'keep-all',
  lineHeight: '22px',
  height: '22px',
  padding: '0 6px',
  paddingBlock: '0',
  paddingInline: '6px',
  minHeight: '0',
  maxHeight: 'none',
  fontSize: '14px',
  fontWeight: '700',
  boxShadow: 'none',
  webkitLineClamp: 'unset',
  webkitBoxOrient: 'initial',
}

export const COVERAGE_PDF_INLINE_BADGE_STYLES: Partial<CSSStyleDeclaration> = {
  display: 'inline-block',
  height: '22px',
  minHeight: '22px',
  margin: '0',
  padding: '0 8px',
  boxSizing: 'border-box',
  lineHeight: '22px',
  fontSize: '11px',
  fontWeight: '700',
  textAlign: 'center',
  overflow: 'visible',
  verticalAlign: 'middle',
  transform: 'none',
}

export const COVERAGE_PDF_INLINE_BADGE_LABEL_STYLES: Partial<CSSStyleDeclaration> = {
  display: 'inline-block',
  position: 'relative',
  top: '0',
  lineHeight: '22px',
  height: '22px',
  fontSize: '11px',
  fontWeight: '700',
}

export type CoveragePdfTitleSafetyIssue = {
  label: string
  reason: string
}

export type CoveragePdfTitleComputedStyle = {
  label: string
  fontFamily: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  height: number
  minHeight: string
  scrollHeight: number
  clientHeight: number
  overflow: string
  whiteSpace: string
  textOverflow: string
  transform: string
  display: string
  rect: {
    x: number
    y: number
    width: number
    height: number
  }
}

export type CoveragePdfBadgeComputedStyle = {
  label: string
  display: string
  height: number
  minHeight: string
  lineHeight: string
  paddingTop: string
  paddingBottom: string
  alignItems: string
  justifyContent: string
  fontSize: string
  fontFamily: string
  transform: string
  verticalAlign: string
}

export function readCoveragePdfBadgeComputedStyle(
  badge: HTMLElement,
): CoveragePdfBadgeComputedStyle {
  const style = window.getComputedStyle(badge)
  return {
    label: badge.textContent?.trim() ?? '',
    display: style.display,
    height: badge.getBoundingClientRect().height,
    minHeight: style.minHeight,
    lineHeight: style.lineHeight,
    paddingTop: style.paddingTop,
    paddingBottom: style.paddingBottom,
    alignItems: style.alignItems,
    justifyContent: style.justifyContent,
    fontSize: style.fontSize,
    fontFamily: style.fontFamily,
    transform: style.transform,
    verticalAlign: style.verticalAlign,
  }
}

export function readCoveragePdfTitleComputedStyle(
  label: HTMLElement,
): CoveragePdfTitleComputedStyle {
  const style = window.getComputedStyle(label)
  const rect = label.getBoundingClientRect()
  return {
    label: label.textContent?.trim() ?? '',
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    height: rect.height,
    minHeight: style.minHeight,
    scrollHeight: label.scrollHeight,
    clientHeight: label.clientHeight,
    overflow: style.overflow,
    whiteSpace: style.whiteSpace,
    textOverflow: style.textOverflow,
    transform: style.transform,
    display: style.display,
    rect: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
  }
}

export function collectCoveragePdfTitleSafetyIssues(root: HTMLElement): CoveragePdfTitleSafetyIssue[] {
  const issues: CoveragePdfTitleSafetyIssue[] = []
  const labels = root.querySelectorAll<HTMLElement>(TITLE_LABEL_SELECTOR)

  labels.forEach((label) => {
    const text = label.textContent?.trim() ?? ''
    if (!text) return
    const style = window.getComputedStyle(label)
    const overflow = style.overflow
    const textOverflow = style.textOverflow
    const whiteSpace = style.whiteSpace

    if (overflow === 'hidden' && textOverflow === 'ellipsis') {
      issues.push({ label: text, reason: 'title uses ellipsis overflow (print unsafe)' })
    }
    if (whiteSpace === 'nowrap' && label.scrollWidth > label.clientWidth + 1) {
      issues.push({ label: text, reason: 'nowrap title exceeds visible width' })
    }
    if (label.scrollHeight > label.clientHeight + 1 && overflow !== 'visible') {
      issues.push({ label: text, reason: 'title content is vertically clipped' })
    }

    const lineHeight = Number.parseFloat(style.lineHeight)
    const rect = label.getBoundingClientRect()
    if (
      rect.height > 0 &&
      Number.isFinite(lineHeight) &&
      lineHeight > 0 &&
      rect.height < lineHeight * 0.92
    ) {
      issues.push({ label: text, reason: 'title box shorter than line-height (glyph clip risk)' })
    }
  })

  return issues
}

export function assertCoveragePdfTitleTextSafety(root: HTMLElement): void {
  const issues = collectCoveragePdfTitleSafetyIssues(root)
  if (issues.length === 0) return
  const detail = issues.map((entry) => `${entry.label}: ${entry.reason}`).join('; ')
  throw new Error(`Coverage PDF title text safety failed: ${detail}`)
}

export type CoveragePdfCaptureFixOptions = {
  /** html2canvas onclone 전용. 라이브 루트에는 두면 미리보기 글자가 위로 밀린다. */
  rasterShift?: boolean
}

function assignInlineStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(element.style, styles)
}

function applyPrintRowLineLayout(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.cs-axis-event__head').forEach((head) => {
    assignInlineStyles(head, COVERAGE_PDF_INLINE_HEAD_STYLES)
  })
  root.querySelectorAll<HTMLElement>('.cs-axis-event__badge').forEach((wrap) => {
    assignInlineStyles(wrap, COVERAGE_PDF_INLINE_BADGE_WRAP_STYLES)
  })
  root.querySelectorAll<HTMLElement>('.cs-axis-event__title-axis').forEach((axis) => {
    assignInlineStyles(axis, COVERAGE_PDF_INLINE_TITLE_AXIS_STYLES)
  })
  root.querySelectorAll<HTMLElement>(TITLE_LABEL_SELECTOR).forEach((label) => {
    assignInlineStyles(label, COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES)
  })
  root.querySelectorAll<HTMLElement>('.coverage-simulator-badge').forEach((badge) => {
    assignInlineStyles(badge, COVERAGE_PDF_INLINE_BADGE_STYLES)
  })
  root.querySelectorAll<HTMLElement>(BADGE_LABEL_SELECTOR).forEach((label) => {
    assignInlineStyles(label, COVERAGE_PDF_INLINE_BADGE_LABEL_STYLES)
  })
}

function applyRasterGlyphShift(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(BADGE_LABEL_SELECTOR).forEach((label) => {
    label.style.top = COVERAGE_PDF_BADGE_RASTER_SHIFT_PX
  })
  root.querySelectorAll<HTMLElement>(TITLE_LABEL_SELECTOR).forEach((label) => {
    label.style.top = COVERAGE_PDF_TITLE_RASTER_SHIFT_PX
  })
}

/**
 * 캡처 직전 인라인 레이아웃.
 * rasterShift는 html2canvas clone에만 켠다. 화면·라이브 루트는 top 0인 22px 라인박스를 유지한다.
 */
export function applyCoveragePdfCaptureCloneFixes(
  root: HTMLElement,
  options?: CoveragePdfCaptureFixOptions,
): void {
  applyPrintRowLineLayout(root)
  if (options?.rasterShift) applyRasterGlyphShift(root)

  root.querySelectorAll<HTMLElement>('.cs-axis-amount__value').forEach((amount) => {
    amount.style.whiteSpace = 'nowrap'
    amount.style.overflow = 'visible'
    amount.style.lineHeight = '1.45'
  })
}

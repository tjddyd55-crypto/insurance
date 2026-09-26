const TITLE_LABEL_SELECTOR = '.cs-axis-event__title-axis .cs-axis-event__label'

export const COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES: Partial<CSSStyleDeclaration> = {
  display: 'inline-block',
  overflow: 'visible',
  textOverflow: 'clip',
  whiteSpace: 'normal',
  wordBreak: 'keep-all',
  lineHeight: '1.45',
  paddingBlock: '3px',
  paddingInline: '6px',
  minHeight: '1.45em',
  maxHeight: 'none',
  boxShadow: 'none',
  webkitLineClamp: 'unset',
  webkitBoxOrient: 'initial',
}

export const COVERAGE_PDF_INLINE_BADGE_STYLES: Partial<CSSStyleDeclaration> = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '22px',
  minHeight: '22px',
  padding: '0 8px',
  boxSizing: 'border-box',
  lineHeight: '1',
  overflow: 'visible',
  verticalAlign: 'middle',
  transform: 'none',
}

/** html2canvas raster — 한글 badge glyph optical center (print namespace only). */
export const COVERAGE_PDF_INLINE_BADGE_GLYPH_STYLES: Partial<CSSStyleDeclaration> = {
  display: 'block',
  margin: '0',
  lineHeight: '1',
  transform: 'translateY(-2.5px)',
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

/** html2canvas clone — inline overrides so screen ellipsis/transform never rasterize. */
export function applyCoveragePdfCaptureCloneFixes(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.cs-axis-event__head').forEach((head) => {
    head.style.height = 'auto'
    head.style.minHeight = '34px'
    head.style.paddingBlock = '4px'
    head.style.alignItems = 'center'
  })

  root.querySelectorAll<HTMLElement>('.cs-axis-event__title-axis').forEach((axis) => {
    axis.style.position = 'relative'
    axis.style.left = 'auto'
    axis.style.top = 'auto'
    axis.style.transform = 'none'
    axis.style.margin = '0'
    axis.style.pointerEvents = 'none'
  })

  root.querySelectorAll<HTMLElement>(TITLE_LABEL_SELECTOR).forEach((label) => {
    Object.assign(label.style, COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES)
  })

  root.querySelectorAll<HTMLElement>('.coverage-simulator-badge').forEach((badge) => {
    Object.assign(badge.style, COVERAGE_PDF_INLINE_BADGE_STYLES)
    badge.querySelectorAll<HTMLElement>('.coverage-simulator-badge__glyph').forEach((glyph) => {
      Object.assign(glyph.style, COVERAGE_PDF_INLINE_BADGE_GLYPH_STYLES)
    })
  })

  root.querySelectorAll<HTMLElement>('.cs-axis-amount__value').forEach((amount) => {
    amount.style.whiteSpace = 'nowrap'
    amount.style.overflow = 'visible'
    amount.style.lineHeight = '1.45'
  })
}

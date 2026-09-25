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
}

export type CoveragePdfTitleSafetyIssue = {
  label: string
  reason: string
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
    head.style.minHeight = '2.75em'
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
    badge.style.lineHeight = '1.35'
    badge.style.minHeight = '22px'
    badge.style.paddingBlock = '3px'
    badge.style.overflow = 'visible'
  })

  root.querySelectorAll<HTMLElement>('.cs-axis-amount__value').forEach((amount) => {
    amount.style.whiteSpace = 'nowrap'
    amount.style.overflow = 'visible'
    amount.style.lineHeight = '1.45'
  })
}

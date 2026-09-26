/** A4 content width at 96dpi — PDF print root and html2canvas must share this width. */
export const COVERAGE_PDF_CAPTURE_WIDTH_PX = 794

async function waitForLayoutStability(root: HTMLElement, maxFrames = 6): Promise<void> {
  let lastHeight = -1
  for (let frame = 0; frame < maxFrames; frame += 1) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
    const height = root.scrollHeight
    if (frame >= 2 && height === lastHeight) {
      return
    }
    lastHeight = height
  }
}

export async function waitForCoveragePdfLayout(root: HTMLElement): Promise<void> {
  if (document.fonts?.ready) {
    await document.fonts.ready
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
  await waitForLayoutStability(root)
  root.getBoundingClientRect()
}

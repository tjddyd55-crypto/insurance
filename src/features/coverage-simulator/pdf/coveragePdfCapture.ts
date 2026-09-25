/** A4 content width at 96dpi — PDF print root and html2canvas must share this width. */
export const COVERAGE_PDF_CAPTURE_WIDTH_PX = 794

export async function waitForCoveragePdfLayout(root: HTMLElement): Promise<void> {
  if (document.fonts?.ready) {
    await document.fonts.ready
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
  root.getBoundingClientRect()
  await new Promise((resolve) => setTimeout(resolve, 60))
}

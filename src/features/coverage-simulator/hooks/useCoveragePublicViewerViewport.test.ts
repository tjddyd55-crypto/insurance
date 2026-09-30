import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const hookPath = join(dirname(fileURLToPath(import.meta.url)), 'useCoveragePublicViewerViewport.ts')
const sharePagePath = join(dirname(fileURLToPath(import.meta.url)), '../pages/CoverageSharePublicPage.tsx')

describe('useCoveragePublicViewerViewport', () => {
  it('removes maximum-scale=1 while mounted', () => {
    const src = readFileSync(hookPath, 'utf8')
    expect(src).toMatch(/maximum-scale=1/)
    expect(src).toMatch(/PINCH_ZOOM_VIEWPORT/)
  })

  it('is wired on public share page', () => {
    const src = readFileSync(sharePagePath, 'utf8')
    expect(src).toMatch(/useCoveragePublicViewerViewport/)
  })
})

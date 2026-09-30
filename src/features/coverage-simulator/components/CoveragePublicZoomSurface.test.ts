import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const surfacePath = join(dirname(fileURLToPath(import.meta.url)), 'CoveragePublicZoomSurface.tsx')
const sharePagePath = join(dirname(fileURLToPath(import.meta.url)), '../pages/CoverageSharePublicPage.tsx')

describe('CoveragePublicZoomSurface', () => {
  it('uses news detail pinch zoom hooks', () => {
    const src = readFileSync(surfacePath, 'utf8')
    expect(src).toMatch(/useNewsDetailViewerPinchZoom/)
    expect(src).toMatch(/useNewsDetailViewerPan/)
  })

  it('wraps public share timeline content', () => {
    const src = readFileSync(sharePagePath, 'utf8')
    expect(src).toMatch(/CoveragePublicZoomSurface/)
  })
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

function readSrc(relPath) {
  return readFileSync(join(ROOT, relPath), 'utf8')
}

test('introduction typo route is registered before ProtectedRoute', () => {
  const router = readSrc('src/appRouter.tsx')
  const protectedIdx = router.indexOf('element: <ProtectedRoute />')
  assert.ok(protectedIdx > 0, 'ProtectedRoute must exist')

  const typoIdx = router.indexOf("{ path: 'intodution', element: <IntroductionPage /> }")
  assert.ok(typoIdx > 0, 'intodution public route must be defined')
  assert.ok(typoIdx < protectedIdx, 'intodution must be outside ProtectedRoute')

  const canonicalIdx = router.indexOf("{ path: 'introduction', element: <IntroductionPage /> }")
  assert.ok(canonicalIdx > 0 && canonicalIdx < protectedIdx)
})

test('AppLayout uses introduction public path SSOT', () => {
  const layout = readSrc('src/AppLayout.tsx')
  assert.match(layout, /isIntroductionPublicPath/)
  assert.doesNotMatch(layout, /pathname === '\/introduction'/)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCoverageSharePageTitle,
  COVERAGE_SHARE_PAGE_DESCRIPTION,
  injectCoverageSharePublicMeta,
} from './coverageSharePublicMeta.js'

test('buildCoverageSharePageTitle uses customer name', () => {
  assert.equal(buildCoverageSharePageTitle('김민수'), '김민수님 보장 시뮬레이션')
  assert.equal(buildCoverageSharePageTitle(''), '보장 시뮬레이션')
})

test('injectCoverageSharePublicMeta adds og tags and noindex', () => {
  const html = '<html><head><title>ONE FC</title></head><body></body></html>'
  const out = injectCoverageSharePublicMeta(
    html,
    { customerName: '김민수' },
    { protocol: 'https', get: () => 'insurance-dev.up.railway.app', headers: {} },
  )
  assert.match(out, /property="og:title" content="김민수님 보장 시뮬레이션"/)
  assert.match(out, new RegExp(`property="og:description" content="${COVERAGE_SHARE_PAGE_DESCRIPTION}"`))
  assert.match(out, /name="robots" content="noindex, nofollow"/)
  assert.match(out, /property="og:image" content="https:\/\/insurance-dev\.up\.railway\.app\/icon\.png"/)
})

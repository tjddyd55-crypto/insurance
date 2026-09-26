import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCoveragePdfArtifactDownloadUrl,
  decodeCoveragePdfFileNameHeader,
} from './coveragePdfArtifactService.js'

test('decodeCoveragePdfFileNameHeader preserves UTF-8 filename', () => {
  const encoded = encodeURIComponent('김민수_암치료_보장시뮬레이션_2026-09-25.pdf')
  assert.equal(
    decodeCoveragePdfFileNameHeader(encoded),
    '김민수_암치료_보장시뮬레이션_2026-09-25.pdf',
  )
})

test('buildCoveragePdfArtifactDownloadUrl returns normal HTTPS endpoint', () => {
  const req = {
    headers: {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'insurance-dev.up.railway.app',
    },
    protocol: 'http',
    get: () => 'localhost:3001',
  }
  assert.equal(
    buildCoveragePdfArtifactDownloadUrl(req, 'token_123'),
    'https://insurance-dev.up.railway.app/api/public/coverage-pdf-artifacts/token_123/download',
  )
})

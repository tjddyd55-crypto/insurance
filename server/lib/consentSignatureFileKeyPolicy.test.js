import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  isAllowedConsentResultFileKey,
  isAllowedSignatureFileKey,
  normalizeStorageObjectKey,
} from './consentSignatureFileKeyPolicy.js'

const dir = dirname(fileURLToPath(import.meta.url))

test('normalizeStorageObjectKey rejects traversal and empty', () => {
  assert.equal(normalizeStorageObjectKey('../secrets'), '')
  assert.equal(normalizeStorageObjectKey(''), '')
})

test('isAllowedConsentResultFileKey accepts generated consent path', () => {
  const key =
    'insurer/yjasset/agent-1/customers/519/consents/2026/09/07/1725680000000_consent-result.pdf'
  assert.equal(isAllowedConsentResultFileKey(key), true)
})

test('isAllowedConsentResultFileKey rejects arbitrary insurer key', () => {
  assert.equal(isAllowedConsentResultFileKey('insurer/other/agent/secret.pdf'), false)
})

test('isAllowedSignatureFileKey accepts signature row key', () => {
  assert.equal(isAllowedSignatureFileKey('signatures/12/519/uuid.png'), true)
})

test('isAllowedSignatureFileKey rejects cross-tenant style path', () => {
  assert.equal(isAllowedSignatureFileKey('signatures/../12/519/uuid.png'), false)
  assert.equal(isAllowedSignatureFileKey('insurer/12/519/file.png'), false)
})

test('consent and signature file routes enforce key policy', () => {
  const consentApi = readFileSync(join(dir, '../registerConsentApi.js'), 'utf8')
  const signatureApi = readFileSync(join(dir, '../registerSignatureApi.js'), 'utf8')
  assert.match(consentApi, /isAllowedConsentResultFileKey\(key\)/)
  assert.match(signatureApi, /isAllowedSignatureFileKey\(key\)/)
  assert.match(signatureApi, /FROM signature/)
})

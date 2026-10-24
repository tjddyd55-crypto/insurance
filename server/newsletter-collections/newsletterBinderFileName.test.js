import assert from 'node:assert/strict'
import test from 'node:test'
import { buildNewsletterBinderPdfFileName } from './newsletterBinderFileName.js'
import { sanitizeStorageFileNameForObjectKey } from '../lib/storageFileNameValidation.js'
import { buildInsuranceUserStorageKey, INSURANCE_STORAGE_CATEGORY } from '../lib/insuranceStorageLayout.js'
import { collectStorageFileObjectKeyCandidates } from '../lib/storageFileObjectKey.js'

const cases = [
  ['보험금 청구 안내', '보험금 청구 안내.pdf'],
  ['보험금 청구 안내.', '보험금 청구 안내.pdf'],
  ['보험금 청구 안내..', '보험금 청구 안내.pdf'],
  ['보험금 청구 안내...', '보험금 청구 안내.pdf'],
  ['보험..청구', '보험.청구.pdf'],
  ['보험/청구', '보험 청구.pdf'],
  ['보험\\청구', '보험 청구.pdf'],
  ['../보험', '보험.pdf'],
  [' 보험 안내... ', '보험 안내.pdf'],
  ['...', '소식지.pdf'],
  ['', '소식지.pdf'],
  ['안내.pdf', '안내.pdf'],
  ['...안내...', '안내.pdf'],
]

/** persistPersonalStoragePdf 와 동일한 key 생성 경로 */
function storageKeyFor(fileName) {
  const safe = sanitizeStorageFileNameForObjectKey(fileName)
  return buildInsuranceUserStorageKey({
    gaCode: 'ga-1',
    userId: 'qa-user',
    category: INSURANCE_STORAGE_CATEGORY.PERSONAL_FILES,
    originalName: safe.endsWith('.pdf') ? safe : `${safe}.pdf`,
  })
}

for (const [input, expected] of cases) {
  test(`newsletter binder filename: ${JSON.stringify(input)}`, () => {
    const name = buildNewsletterBinderPdfFileName(input)
    assert.equal(name, expected)
    assert.ok(!name.includes('..'))
    assert.ok(!/[\\/]/.test(name))
    assert.ok(name.endsWith('.pdf') && !name.endsWith('.pdf.pdf'))
    const key = storageKeyFor(name)
    assert.ok(!key.includes('..'))
    assert.ok(collectStorageFileObjectKeyCandidates(key).length >= 1)
  })
}

test('regression: legacy filename for "...안내..." had 0 storage candidates', () => {
  const legacy = `${'...안내...'.trim()}.pdf`
  assert.equal(collectStorageFileObjectKeyCandidates(storageKeyFor(legacy)).length, 0)
})

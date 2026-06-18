import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CLAIM_BUNDLE_MAX_FILES,
  CLAIM_BUNDLE_MAX_TOTAL_BYTES,
  assertClaimBundleWithinLimits,
  buildClaimBundleDownloadName,
  normalizeClaimFileMime,
  resolveUniqueZipEntryNames,
} from './claimRequestFileBundle.js'

test('normalizeClaimFileMime — 확장자 폴백', () => {
  assert.equal(normalizeClaimFileMime('', 'photo.JPG'), 'image/jpeg')
  assert.equal(normalizeClaimFileMime('', 'scan.png'), 'image/png')
  assert.equal(normalizeClaimFileMime('', 'doc.pdf'), 'application/pdf')
})

test('resolveUniqueZipEntryNames — 중복 파일명 번호 부여', () => {
  const names = resolveUniqueZipEntryNames([
    { fileName: 'a.jpg' },
    { fileName: 'b.pdf' },
    { fileName: 'a.jpg' },
    { fileName: 'readme' },
    { fileName: 'readme' },
  ])
  assert.deepEqual(names, ['a.jpg', 'b.pdf', 'a (1).jpg', 'readme', 'readme (1)'])
})

test('assertClaimBundleWithinLimits — 빈 목록', () => {
  assert.throws(() => assertClaimBundleWithinLimits([]), /첨부 파일이 없습니다/)
})

test('assertClaimBundleWithinLimits — 파일 수 초과', () => {
  const files = Array.from({ length: CLAIM_BUNDLE_MAX_FILES + 1 }, (_, i) => ({
    fileName: `f${i}.jpg`,
    fileSize: 1,
  }))
  assert.throws(() => assertClaimBundleWithinLimits(files), /너무 많거나/)
})

test('assertClaimBundleWithinLimits — 총 용량 초과', () => {
  assert.throws(
    () =>
      assertClaimBundleWithinLimits([
        { fileName: 'big.pdf', fileSize: CLAIM_BUNDLE_MAX_TOTAL_BYTES + 1 },
      ]),
    /너무 많거나/,
  )
})

test('buildClaimBundleDownloadName — 한글 고객명 포함', () => {
  assert.equal(buildClaimBundleDownloadName('홍길동', 32, 'zip'), '청구자료_홍길동_32.zip')
  assert.equal(buildClaimBundleDownloadName('홍길동', 32, 'pdf'), '청구자료_홍길동_32.pdf')
})

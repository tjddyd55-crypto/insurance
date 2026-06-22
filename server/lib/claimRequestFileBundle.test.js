import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CLAIM_BUNDLE_MAX_FILES,
  CLAIM_BUNDLE_MAX_TOTAL_BYTES,
  assertClaimBundleWithinLimits,
  buildClaimBundleAsciiFallbackName,
  buildClaimBundleDownloadName,
  buildContentDisposition,
  getPdfPageSizeForImage,
  normalizeClaimFileMime,
  resolveUniqueZipEntryNames,
  sanitizeDownloadFileNamePart,
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

test('buildClaimBundleDownloadName — 고객명+날짜 PDF/ZIP', () => {
  assert.equal(
    buildClaimBundleDownloadName('정기원', '2026-06-19T10:00:00.000Z', 'pdf'),
    '정기원_20260619_청구서류.pdf',
  )
  assert.equal(
    buildClaimBundleDownloadName('정기원', '2026-06-19T10:00:00.000Z', 'zip'),
    '정기원_20260619_원본파일.zip',
  )
})

test('sanitizeDownloadFileNamePart — 금지 문자 제거', () => {
  assert.equal(sanitizeDownloadFileNamePart('홍:길*동?'), '홍길동')
  assert.equal(sanitizeDownloadFileNamePart('   '), '고객')
})

test('buildContentDisposition — 한글 filename* 포함', () => {
  const header = buildContentDisposition(
    '정기원_20260619_청구서류.pdf',
    'attachment',
    'claim-files-20260619.pdf',
  )
  assert.match(header, /^attachment;/)
  assert.match(header, /filename="claim-files-20260619\.pdf"/)
  assert.match(header, /filename\*=UTF-8''%EC%A0%95%EA%B8%B0%EC%9B%90_20260619_%EC%B2%AD%EA%B5%AC%EC%84%9C%EB%A5%98\.pdf/)
})

test('buildClaimBundleAsciiFallbackName — ASCII fallback', () => {
  assert.equal(buildClaimBundleAsciiFallbackName('2026-06-19T10:00:00.000Z', 'pdf'), 'claim-files-20260619.pdf')
  assert.equal(buildClaimBundleAsciiFallbackName('2026-06-19T10:00:00.000Z', 'zip'), 'claim-files-20260619.zip')
})

test('getPdfPageSizeForImage — portrait vs landscape', () => {
  const portrait = getPdfPageSizeForImage(800, 1200)
  const landscape = getPdfPageSizeForImage(1200, 800)
  assert.ok(portrait[1] > portrait[0], 'portrait page height > width')
  assert.ok(landscape[0] > landscape[1], 'landscape page width > height')
})

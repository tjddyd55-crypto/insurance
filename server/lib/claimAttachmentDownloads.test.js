import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildContentDisposition,
  buildClaimBundleDownloadName,
  buildClaimBundleAsciiFallbackName,
  sanitizeDownloadFileNamePart,
} from './claimRequestFileBundle.js'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')

function readSrc(relativePath) {
  return readFileSync(join(repoRoot, relativePath), 'utf8')
}

test('buildContentDisposition — attachment + UTF-8 filename*', () => {
  const header = buildContentDisposition(
    '정기원_20260619_원본파일.zip',
    'attachment',
    'claim-files-20260619.zip',
  )
  assert.match(header, /^attachment;/)
  assert.match(header, /filename="claim-files-20260619\.zip"/)
  assert.match(header, /filename\*=UTF-8''/)
})

test('buildClaimBundleAsciiFallbackName — ASCII only', () => {
  assert.equal(buildClaimBundleAsciiFallbackName('2026-06-19', 'pdf'), 'claim-files-20260619.pdf')
})

test('buildClaimBundleDownloadName — 고객명_날짜 suffix', () => {
  assert.equal(
    buildClaimBundleDownloadName('정기원', '2026-06-19T10:00:00.000Z', 'pdf'),
    '정기원_20260619_청구서류.pdf',
  )
  assert.equal(
    buildClaimBundleDownloadName('정기원', '2026-06-19T10:00:00.000Z', 'zip'),
    '정기원_20260619_원본파일.zip',
  )
})

test('sanitizeDownloadFileNamePart — 파일명 금지 문자 제거', () => {
  assert.equal(sanitizeDownloadFileNamePart('A/B:C*'), 'ABC')
})

test('downloadBlobFile — empty blob 은 EMPTY_DOWNLOAD_FILE', () => {
  const src = readSrc('src/utils/downloadBlobFile.ts')
  assert.match(src, /blob\.size === 0/)
  assert.match(src, /EmptyDownloadFileError/)
})

test('downloadBlobFile — filename* 우선 파싱', () => {
  const src = readSrc('src/utils/downloadBlobFile.ts')
  assert.match(src, /filename\*/)
  assert.match(src, /decodeURIComponent/)
})

test('세 화면이 공통 bundle API · 고객 청구페이지 열기 · 상세 UI 를 사용한다', () => {
  const inbox = readSrc('src/features/claim-requests/pages/ClaimInboxPage.tsx')
  const customerDetail = readSrc('src/features/claim-requests/pages/ClaimRequestsPage.tsx')
  const mobileContainer = readSrc('src/features/claim-requests/pages/claim-requests/ClaimRequestsClaimsMobileStandalone.tsx')
  const mobileView = readSrc('src/features/claim-requests/pages/claim-requests/ClaimRequestsClaimsMobileView.tsx')
  const api = readSrc('src/features/claim-requests/api/claimRequestsApi.ts')

  assert.match(inbox, /ClaimRequestDetailBody/)
  assert.match(customerDetail, /ClaimRequestDetailBody/)

  for (const src of [inbox, customerDetail, mobileContainer]) {
    assert.match(src, /downloadClaimRequestFilesPdf/)
    assert.match(src, /downloadClaimRequestFilesZip/)
    assert.match(src, /ensureCustomerClaimPageUrl|openCustomerClaimPageUrl|openCustomerClaimWorkspace/)
  }

  assert.match(mobileView, /ClaimRequestDetailBody/)
  assert.match(mobileView, /onOpenCustomerClaimPage/)
  assert.match(mobileView, /attachmentActionsVariant="mobile"/)

  assert.match(api, /downloadBlobFile/)
  assert.match(api, /fetchClaimRequestBundleBlob/)
  assert.match(api, /buildClaimDownloadFileName/)
  assert.match(api, /getClaimBundleDirectDownloadUrl|bundle-download-url/)
})

test('ClaimRequestAttachmentActions — 첨부 없을 때 disabled 라벨', () => {
  const src = readSrc('src/features/claim-requests/components/ClaimRequestAttachmentActions.tsx')
  assert.match(src, /attachmentCount <= 0/)
  assert.match(src, /PDF로 다운로드/)
  assert.match(src, /원본 전체 다운로드/)
  assert.match(src, /고객 청구페이지 열기/)
})

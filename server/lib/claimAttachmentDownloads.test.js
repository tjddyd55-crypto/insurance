import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildContentDisposition, buildClaimBundleDownloadName } from './claimRequestFileBundle.js'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')

function readSrc(relativePath) {
  return readFileSync(join(repoRoot, relativePath), 'utf8')
}

test('buildContentDisposition — attachment + UTF-8 filename*', () => {
  const header = buildContentDisposition('청구자료_홍길동_35.zip', 'attachment')
  assert.match(header, /^attachment;/)
  assert.match(header, /filename\*=UTF-8''/)
})

test('buildClaimBundleDownloadName — zip/pdf 확장자', () => {
  assert.equal(buildClaimBundleDownloadName('홍길동', 35, 'zip'), '청구자료_홍길동_35.zip')
  assert.equal(buildClaimBundleDownloadName('홍길동', 35, 'pdf'), '청구자료_홍길동_35.pdf')
})

test('downloadBlobFile — empty blob 은 EMPTY_DOWNLOAD_FILE', () => {
  const src = readSrc('src/utils/downloadBlobFile.ts')
  assert.match(src, /blob\.size === 0/)
  assert.match(src, /EmptyDownloadFileError/)
})

test('세 화면이 공통 bundle API · 고객 청구페이지 열기 · 상세 UI 를 사용한다', () => {
  const inbox = readSrc('src/features/claim-requests/pages/ClaimInboxPage.tsx')
  const customerDetail = readSrc('src/features/claim-requests/pages/ClaimRequestsPage.tsx')
  const mobileContainer = readSrc('src/features/claim-requests/pages/claim-requests/ClaimRequestsClaimsMobileStandalone.tsx')
  const mobileView = readSrc('src/features/claim-requests/pages/claim-requests/ClaimRequestsClaimsMobileView.tsx')
  const api = readSrc('src/features/claim-requests/api/claimRequestsApi.ts')

  assert.match(inbox, /ClaimRequestAttachmentActions/)
  assert.match(customerDetail, /ClaimRequestAttachmentActions/)

  for (const src of [inbox, customerDetail, mobileContainer]) {
    assert.match(src, /downloadClaimRequestFilesPdf/)
    assert.match(src, /downloadClaimRequestFilesZip/)
    assert.match(src, /ensureCustomerClaimPageUrl|openCustomerClaimPageUrl/)
  }

  assert.match(mobileView, /ClaimRequestDetailBody/)
  assert.match(mobileView, /onOpenCustomerClaimPage/)
  assert.match(mobileView, /attachmentActionsVariant="mobile"/)

  assert.match(api, /downloadBlobFile/)
  assert.match(api, /fetchClaimRequestBundleBlob/)
})

test('ClaimRequestAttachmentActions — 첨부 없을 때 disabled 라벨', () => {
  const src = readSrc('src/features/claim-requests/components/ClaimRequestAttachmentActions.tsx')
  assert.match(src, /attachmentCount <= 0/)
  assert.match(src, /PDF로 다운로드/)
  assert.match(src, /원본 전체 다운로드/)
  assert.match(src, /고객 청구페이지 열기/)
})

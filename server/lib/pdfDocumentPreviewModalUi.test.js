import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

const modalComponentPath = path.join(
  process.cwd(),
  'src/features/pdf-engine/components/PdfDocumentResultPreviewModal.tsx',
)
const modalConfigPath = path.join(
  process.cwd(),
  'src/features/pdf-engine/config/pdfDocumentPreviewModalUi.ts',
)
const detailPagePath = path.join(
  process.cwd(),
  'src/features/pdf-engine/pages/PdfDocumentDetailPage.tsx',
)

describe('pdf document result preview modal UI', () => {
  it('uses shared modal component from PdfDocumentDetailPage', () => {
    const pageSrc = fs.readFileSync(detailPagePath, 'utf8')
    assert.match(pageSrc, /PdfDocumentResultPreviewModal/)
    assert.equal(pageSrc.includes('저장하기'), false)
  })

  it('does not expose 저장하기 in preview modal component', () => {
    const modalSrc = fs.readFileSync(modalComponentPath, 'utf8')
    assert.equal(modalSrc.includes('저장하기'), false)
    assert.match(modalSrc, /다운로드/)
    assert.match(modalSrc, /닫기/)
    assert.match(modalSrc, /수정하기/)
  })

  it('keeps develop subtitle copy in config', () => {
    const configSrc = fs.readFileSync(modalConfigPath, 'utf8')
    assert.match(configSrc, /발급 이력은 다운로드 시 저장됩니다/)
    assert.equal(configSrc.includes('저장·뷰어'), false)
  })
})

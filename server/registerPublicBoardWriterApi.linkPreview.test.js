import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiSource = readFileSync(path.join(__dirname, 'registerPublicBoardWriterApi.js'), 'utf8')
const editorSource = readFileSync(
  path.join(__dirname, '../src/features/insurer-news/components/LinkPreviewEditor.tsx'),
  'utf8',
)
const uploadPageSource = readFileSync(
  path.join(__dirname, '../src/features/insurer-news/pages/BoardWriterNewsUploadPage.tsx'),
  'utf8',
)

test('registerPublicBoardWriterApi exposes board-writer link-preview routes with auth', () => {
  assert.match(apiSource, /apiRouter\.post\('\/board-writer\/link-preview', requireBoardWriterAuth, fetchWriterLinkPreview\)/)
  assert.match(
    apiSource,
    /apiRouter\.post\('\/public-board-writer\/link-preview', requireBoardWriterAuth, fetchWriterLinkPreview\)/,
  )
  assert.match(apiSource, /fetchNewsletterLinkPreviewForApi/)
})

test('board-writer upload page uses board-writer link-preview endpoint', () => {
  assert.match(uploadPageSource, /linkPreviewEndpoint="\/api\/board-writer\/link-preview"/)
})

test('LinkPreviewEditor keeps insurer-news endpoint as default', () => {
  assert.match(editorSource, /DEFAULT_LINK_PREVIEW_ENDPOINT = '\/api\/insurer-news\/link-preview'/)
  assert.match(editorSource, /previewEndpoint = DEFAULT_LINK_PREVIEW_ENDPOINT/)
})

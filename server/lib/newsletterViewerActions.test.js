import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '../..')

function read(relPath) {
  return readFileSync(path.join(root, relPath), 'utf8')
}

test('insurer manager list views do not wire delete actions on list cards', () => {
  const pcSrc = read('src/features/insurer-news/pages/InsurerManagerNewsList/InsurerManagerNewsListPCView.tsx')
  const mobileSrc = read('src/features/insurer-news/pages/InsurerManagerNewsList/InsurerManagerNewsListMobileView.tsx')

  assert.doesNotMatch(pcSrc, /<NewsletterList[\s\S]*onDeleteItem=/)
  assert.doesNotMatch(mobileSrc, /<NewsletterList[\s\S]*onDeleteItem=/)
})

test('insurer manager PC modal uses shared viewer header actions for delete', () => {
  const pcSrc = read('src/features/insurer-news/pages/InsurerManagerNewsList/InsurerManagerNewsListPCView.tsx')
  assert.match(pcSrc, /NewsletterViewerHeaderActions/)
  assert.match(pcSrc, /canDelete=\{canDeleteSelected\}/)
  assert.match(pcSrc, /onDelete=\{handleModalDelete\}/)
})

test('detail pages use shared viewer header actions', () => {
  const insurerDetail = read('src/features/insurer-news/pages/InsurerManagerNewsDetailPage.tsx')
  const boardWriterDetail = read('src/features/insurer-news/pages/BoardWriterNewsDetailPage.tsx')
  const dynamicDetail = read('src/features/insurer-news/pages/DynamicNewsletterBoardDetailPage.tsx')

  assert.match(insurerDetail, /NewsletterViewerHeaderActions/)
  assert.match(boardWriterDetail, /NewsletterViewerHeaderActions/)
  assert.match(dynamicDetail, /NewsletterViewerHeaderActions/)
  assert.match(boardWriterDetail, /canEdit=\{isAuthor\}/)
  assert.match(boardWriterDetail, /canDelete=\{isAuthor\}/)
})

test('shared header actions component follows board-writer button variants', () => {
  const actionsSrc = read('src/features/insurer-news/components/NewsletterViewerHeaderActions.tsx')
  assert.match(actionsSrc, /variant="primary"/)
  assert.match(actionsSrc, /variant="secondary"/)
  assert.match(actionsSrc, /download-btn/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const gaTenantMenuSource = readFileSync(
  path.join(repoRoot, 'src/features/dashboard/gaTenantMenu.ts'),
  'utf8',
)
const boardWriterNavigationSource = readFileSync(
  path.join(repoRoot, 'src/features/insurer-news/config/boardWriterNavigation.ts'),
  'utf8',
)

function extractMenuBlock(constName) {
  const match = gaTenantMenuSource.match(
    new RegExp(`export const ${constName}: GaTenantMenuItem\\[] = \\[([\\s\\S]*?)\\]`),
  )
  assert.ok(match, `${constName} block must exist`)
  return match[1]
}

function countMenuLabels(block) {
  return (block.match(/label:/g) ?? []).length
}

test('INSURER_MANAGER writer menu keeps only view and upload links', () => {
  const block = extractMenuBlock('INSURER_MANAGER_MENU')
  assert.equal(countMenuLabels(block), 2)
  assert.match(block, /원수사 소식지 조회/)
  assert.match(block, /원수사 소식지 업로드/)
  assert.doesNotMatch(block, /insurer-sites/)
  assert.doesNotMatch(block, /보험사 설계사이트/)
})

test('LOSS_ADJUSTER writer menu keeps only view and upload links', () => {
  const block = extractMenuBlock('LOSS_ADJUSTER_MENU')
  assert.equal(countMenuLabels(block), 2)
  assert.match(block, /손해사정사 뉴스 조회/)
  assert.match(block, /손해사정사 뉴스 업로드/)
  assert.doesNotMatch(block, /insurer-sites/)
  assert.doesNotMatch(block, /보험사 설계사이트/)
})

test('GA_STAFF menu still includes insurer sites for general staff accounts', () => {
  const block = extractMenuBlock('GA_STAFF_MENU')
  assert.match(block, /insurer-sites/)
})

test('board writer navigation exposes only view and upload routes', () => {
  assert.match(boardWriterNavigationSource, /viewPath = `\/board-writer\/boards\/\$\{encoded\}\/news`/)
  assert.match(boardWriterNavigationSource, /uploadPath: `\$\{viewPath\}\/upload`/)
  assert.match(boardWriterNavigationSource, /공용 소식지 조회/)
  assert.match(boardWriterNavigationSource, /공용 소식지 업로드/)
})

test('board writer nav path helper builds upload under news route', () => {
  const slug = 'notice-board'
  const encoded = encodeURIComponent(slug)
  const viewPath = `/board-writer/boards/${encoded}/news`
  assert.equal(`${viewPath}/upload`, `/board-writer/boards/${encoded}/news/upload`)
})

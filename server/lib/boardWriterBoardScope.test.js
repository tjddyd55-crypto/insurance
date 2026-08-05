import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

test('신규 공용 소식지 생성은 기존 global 작성자에게 자동 권한을 부여하지 않는다', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'server/registerInsurerNewsApi.js'), 'utf8')
  assert.doesNotMatch(src, /import\s*\{[^}]*grantBoardToAllGlobalWriters/)
  const createFn = src.slice(src.indexOf('async function createNewsletterBoardRecord'), src.indexOf('async function', src.indexOf('async function createNewsletterBoardRecord') + 1))
  assert.match(createFn, /INSERT_GLOBAL_NEWSLETTER_BOARD_SQL/)
  assert.doesNotMatch(createFn, /grantBoardToAllGlobalWriters/)
})

test('레거시 작성자 생성은 boardIds 없이 전체 소식지 자동 부여를 하지 않는다', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'server/registerPublicBoardWriterApi.js'), 'utf8')
  assert.doesNotMatch(src, /grantAllGlobalBoardsToWriter\(/)
  assert.doesNotMatch(src, /grantAllGaBoardsToWriter\(/)
  assert.match(src, /작성 권한을 부여할 공용 소식지를 1개 이상 선택해 주세요/)
  assert.match(src, /작성 권한을 부여할 GA 소식지를 1개 이상 선택해 주세요/)
})

test('게시판별 작성자 목록 SQL은 board_writer_permissions.board_id 조인을 사용한다', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'server/lib/boardWriterAccountService.js'), 'utf8')
  assert.match(src, /INNER JOIN board_writer_permissions p ON p\.writer_account_id = w\.id AND p\.board_id = \$1/)
  assert.match(src, /revokeWriterBoardPermission/)
})

test('작성자 패널은 board.id 변경 시 목록을 비우고 key로 분리한다', () => {
  const panel = fs.readFileSync(
    path.join(repoRoot, 'src/features/insurer-news/pages/NewsletterBoardAdmin/NewsletterBoardWriterPanel.tsx'),
    'utf8',
  )
  const view = fs.readFileSync(
    path.join(repoRoot, 'src/features/insurer-news/pages/NewsletterBoardAdmin/NewsletterBoardAdminView.tsx'),
    'utf8',
  )
  assert.match(panel, /setWriters\(\[\]\)/)
  assert.match(panel, /등록된 작성자가 없습니다/)
  assert.match(panel, /이 소식지에 글을 등록할 작성자 계정을 추가해 주세요/)
  assert.match(view, /key=\{selectedBoard\.id\}/)
})

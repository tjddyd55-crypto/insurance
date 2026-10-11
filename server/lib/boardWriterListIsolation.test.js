import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

test('listWriterAccountsForBoard 는 board_id 파라미터로 permission 을 조인한다', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'server/lib/boardWriterAccountService.js'), 'utf8')
  const fn = src.slice(
    src.indexOf('export async function listWriterAccountsForBoard'),
    src.indexOf('export async function', src.indexOf('export async function listWriterAccountsForBoard') + 1),
  )
  assert.match(fn, /p\.board_id = \$1/)
  assert.doesNotMatch(fn, /owner_ga_id = \$1/)
  assert.doesNotMatch(fn, /ORDER BY b\.created_at DESC LIMIT 1/)
})

test('게시판 생성 경로는 writer permission 을 변경하지 않는다', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'server/registerInsurerNewsApi.js'), 'utf8')
  const createFn = src.slice(
    src.indexOf('async function createNewsletterBoardRecord'),
    src.indexOf('async function', src.indexOf('async function createNewsletterBoardRecord') + 1),
  )
  assert.doesNotMatch(createFn, /board_writer_permissions/)
  assert.doesNotMatch(createFn, /replaceWriterBoardPermissions/)
})

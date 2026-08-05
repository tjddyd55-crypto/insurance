import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

test('newsletter board soft delete SQL requires is_deleted = false and returns row', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'server/lib/newsletterBoardAdminSql.js'), 'utf8')
  assert.match(src, /SUPER_ADMIN_NEWSLETTER_BOARD_SOFT_DELETE_SQL[\s\S]*is_deleted = false[\s\S]*RETURNING \*/)
  assert.match(src, /GA_ADMIN_NEWSLETTER_BOARD_SOFT_DELETE_SQL[\s\S]*is_deleted = false[\s\S]*RETURNING \*/)
})

test('board delete handler revokes writer permissions and writes PUBLIC_BOARD_DELETED audit', () => {
  const soft = fs.readFileSync(path.join(repoRoot, 'server/lib/newsletterBoardSoftDelete.js'), 'utf8')
  assert.match(soft, /DELETE FROM board_writer_permissions WHERE board_id = \$1/)
  assert.match(soft, /action: 'PUBLIC_BOARD_DELETED'/)
  assert.match(soft, /loadNewsletterBoardDeleteImpact/)
  assert.doesNotMatch(soft, /DELETE FROM insurance_company_newsletters/)
  assert.doesNotMatch(soft, /DELETE FROM insurance_company_newsletter_attachments/)
  assert.doesNotMatch(soft, /DELETE FROM board_writer_accounts/)
})

test('admin board delete UI wires dedicated delete handler and button', () => {
  const page = fs.readFileSync(
    path.join(repoRoot, 'src/features/insurer-news/pages/NewsletterBoardAdminPage.tsx'),
    'utf8',
  )
  const view = fs.readFileSync(
    path.join(repoRoot, 'src/features/insurer-news/pages/NewsletterBoardAdmin/NewsletterBoardAdminView.tsx'),
    'utf8',
  )
  assert.match(page, /onDelete: handleDelete/)
  assert.doesNotMatch(page, /onDelete: handleDisable/)
  assert.match(page, /공용 소식지를 삭제할까요\?/)
  assert.match(page, /fetchNewsletterBoardDeleteImpact/)
  assert.match(view, />\s*삭제\s*</)
  assert.match(view, /actions\.canDelete/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const css = readFileSync(join(root, 'src/features/admin/admin-ui.css'), 'utf8')
const composer = readFileSync(
  join(root, 'src/features/admin/components/CrmUserBulkSmsComposerDialog.tsx'),
  'utf8',
)
const history = readFileSync(
  join(root, 'src/features/admin/components/CrmUserBulkSmsHistoryDetailDialog.tsx'),
  'utf8',
)

describe('crm user bulk sms dialog layout', () => {
  it('caps composer panel width at 720px and keeps max-height', () => {
    assert.match(css, /\.admin-modal-panel\.admin-user-bulk-sms-modal[\s\S]*?720px/)
    assert.match(css, /\.admin-modal-panel\.admin-user-bulk-sms-modal[\s\S]*?max-height:\s*min\(820px/)
  })

  it('scrolls FormDialog body wrapper and pins footer', () => {
    assert.match(css, /\.admin-user-bulk-sms-modal\s*>\s*\.mt-4[\s\S]*?overflow-y:\s*auto/)
    assert.match(css, /\.admin-user-bulk-sms-modal\s*>\s*\.mt-5[\s\S]*?flex:\s*0\s+0\s+auto/)
  })

  it('keeps single-line inputs at control-height-md and textarea taller', () => {
    assert.match(
      css,
      /\.admin-user-bulk-sms-modal\s+\.admin-form-input:not\(textarea\)[\s\S]*?--control-height-md/,
    )
    assert.match(css, /\.admin-user-bulk-sms-modal__textarea[\s\S]*?min-height:\s*160px/)
  })

  it('uses mobile full-width and stacked footer actions', () => {
    assert.match(css, /@media\s*\(max-width:\s*480px\)[\s\S]*?calc\(100vw - 16px\)/)
    assert.match(
      css,
      /\.admin-user-bulk-sms-modal__footer\.admin-modal-actions[\s\S]*?grid-template-columns:\s*1fr\s+1fr/,
    )
  })

  it('keeps FormDialog footer actions order and backdrop blocked', () => {
    assert.match(composer, /closeOnBackdrop=\{false\}/)
    assert.match(composer, /footer=\{/)
    const cancel = composer.indexOf('>\n              취소\n            </FormButton>')
    const preview = composer.indexOf('>\n              미리보기\n            </FormButton>')
    const send = composer.indexOf('>\n              발송\n            </FormButton>')
    assert.ok(cancel >= 0 && preview > cancel && send > preview)
  })

  it('keeps history detail on the same dialog shell', () => {
    assert.match(history, /admin-user-bulk-sms-history-modal/)
    assert.match(history, /closeOnBackdrop=\{false\}/)
    assert.match(history, /footer=\{/)
    assert.match(css, /\.admin-modal-panel\.admin-user-bulk-sms-history-modal[\s\S]*?720px/)
  })
})

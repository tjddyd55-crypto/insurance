import assert from 'node:assert/strict'
import test from 'node:test'
import { ensureInsurerNewsletterBoard, INSURER_BOARD_LABEL, INSURER_BOARD_SLUG } from './insurerNewsletterBoard.js'

test('ensureInsurerNewsletterBoard creates one idempotent GA-only insurer board', async () => {
  const state = { row: null, insertCount: 0 }
  const executor = { query: async (sql, params = []) => {
    if (String(sql).includes('SELECT * FROM newsletter_boards')) return { rows: state.row ? [state.row] : [], rowCount: state.row ? 1 : 0 }
    if (String(sql).includes('INSERT INTO newsletter_boards')) {
      state.insertCount += 1
      state.row = { id: params[0], slug: params[1], label: params[2], owner_ga_id: params[3], system_key: params[4] }
      return { rows: [state.row], rowCount: 1 }
    }
    throw new Error('unexpected query')
  } }
  const first = await ensureInsurerNewsletterBoard(executor, 42)
  const second = await ensureInsurerNewsletterBoard(executor, 42)
  assert.equal(first.label, INSURER_BOARD_LABEL)
  assert.equal(first.slug, INSURER_BOARD_SLUG)
  assert.equal(state.insertCount, 1)
  assert.equal(second.id, first.id)
})

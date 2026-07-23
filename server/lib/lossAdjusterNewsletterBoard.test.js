import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  LOSS_ADJUSTER_BOARD_SLUG,
  LOSS_ADJUSTER_DEFAULT_LABEL,
  LOSS_ADJUSTER_PORTAL_PATH,
  LOSS_ADJUSTER_SYSTEM_KEY,
  ensureLossAdjusterNewsletterBoard,
  isLossAdjusterSystemBoard,
} from './lossAdjusterNewsletterBoard.js'

describe('lossAdjusterNewsletterBoard', () => {
  it('uses LOSS_ADJUSTER system key (not CLAIM_ADJUSTER)', () => {
    assert.equal(LOSS_ADJUSTER_SYSTEM_KEY, 'LOSS_ADJUSTER')
    assert.equal(LOSS_ADJUSTER_DEFAULT_LABEL, '손해사정사 소식지')
    assert.equal(LOSS_ADJUSTER_BOARD_SLUG, 'system-loss-adjuster')
    assert.equal(LOSS_ADJUSTER_PORTAL_PATH, '/portal/adjuster-news')
  })

  it('detects system board by systemKey', () => {
    assert.equal(isLossAdjusterSystemBoard({ systemKey: 'LOSS_ADJUSTER' }), true)
    assert.equal(isLossAdjusterSystemBoard({ system_key: 'LOSS_ADJUSTER' }), true)
    assert.equal(isLossAdjusterSystemBoard({ systemKey: null }), false)
    assert.equal(isLossAdjusterSystemBoard({ systemKey: 'INSURER' }), false)
  })

  it('ensure is idempotent and does not overwrite admin changes', async () => {
    const existing = {
      id: 'existing',
      owner_ga_id: 7,
      system_key: 'LOSS_ADJUSTER',
      label: '보상 실무 자료',
      is_active: false,
      is_deleted: false,
    }
    let insertCount = 0
    const pool = {
      query: async (sql, params) => {
        if (String(sql).includes('INSERT INTO newsletter_boards')) {
          insertCount += 1
          return { rowCount: 1, rows: [existing] }
        }
        if (String(sql).includes('SELECT') && String(sql).includes('system_key')) {
          assert.equal(params[0], 7)
          assert.equal(params[1], 'LOSS_ADJUSTER')
          return { rowCount: 1, rows: [existing] }
        }
        return { rowCount: 0, rows: [] }
      },
    }
    const first = await ensureLossAdjusterNewsletterBoard(pool, 7)
    const second = await ensureLossAdjusterNewsletterBoard(pool, 7)
    assert.equal(first.label, '보상 실무 자료')
    assert.equal(first.is_active, false)
    assert.equal(second.id, first.id)
    assert.equal(insertCount, 0)
  })
})

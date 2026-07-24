import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canManageNewsletterAuthors,
  canManageNewsletterBoard,
  canWriteNewsletterBoard,
  resolveNewsletterBoardPermissions,
} from './newsletterBoardPermissions.js'

const gaBoard = {
  id: 'ga-1',
  board_scope: 'ga',
  owner_ga_id: 7,
  is_active: true,
  system_key: null,
}

const lossAdjusterBoard = {
  id: 'la-1',
  board_scope: 'ga',
  owner_ga_id: 7,
  is_active: true,
  system_key: 'LOSS_ADJUSTER',
}

const globalBoard = {
  id: 'g-1',
  board_scope: 'global',
  owner_ga_id: null,
  is_active: true,
}

describe('newsletterBoardPermissions', () => {
  it('treats LOSS_ADJUSTER like a normal GA board for manage/write', () => {
    const ga = resolveNewsletterBoardPermissions(gaBoard, { role: 'GA_ADMIN', tenantGaId: 7 })
    const la = resolveNewsletterBoardPermissions(lossAdjusterBoard, {
      role: 'GA_ADMIN',
      tenantGaId: 7,
    })
    assert.equal(ga.canManage, true)
    assert.equal(la.canManage, true)
    assert.equal(ga.canManageAuthors, true)
    assert.equal(la.canManageAuthors, true)
    assert.equal(la.isSystemDefault, true)
    assert.equal(la.canHardDelete, false)
    assert.equal(ga.canHardDelete, true)
  })

  it('blocks other GA managers', () => {
    assert.equal(
      canManageNewsletterBoard(lossAdjusterBoard, { role: 'GA_ADMIN', tenantGaId: 99 }),
      false,
    )
    assert.equal(canManageNewsletterAuthors(gaBoard, { role: 'USER', tenantGaId: 7 }), false)
  })

  it('allows assigned writer only for that board', () => {
    assert.equal(
      canWriteNewsletterBoard(
        lossAdjusterBoard,
        { writerAccountId: 'w1', tenantGaId: 7 },
        { assignedBoardId: 'la-1', writerActive: true },
      ),
      true,
    )
    assert.equal(
      canWriteNewsletterBoard(
        gaBoard,
        { writerAccountId: 'w1', tenantGaId: 7 },
        { assignedBoardId: 'la-1', writerActive: true },
      ),
      false,
    )
  })

  it('blocks write on inactive boards', () => {
    const inactive = { ...lossAdjusterBoard, is_active: false }
    assert.equal(
      canWriteNewsletterBoard(
        inactive,
        { writerAccountId: 'w1', tenantGaId: 7 },
        { assignedBoardId: 'la-1', writerActive: true },
      ),
      false,
    )
  })

  it('global board manage is super-admin only', () => {
    assert.equal(canManageNewsletterBoard(globalBoard, { role: 'SUPER_ADMIN' }), true)
    assert.equal(canManageNewsletterBoard(globalBoard, { role: 'GA_ADMIN', tenantGaId: 7 }), false)
  })
})

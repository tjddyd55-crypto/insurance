import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'

import {
  clearPendingConfirmations,
  consumePendingImportCommit,
  createPendingImportCommit,
} from './confirmationService.js'

describe('import commit confirmation gate', () => {
  beforeEach(() => {
    clearPendingConfirmations()
  })

  it('rejects forged user and ga', () => {
    const pending = createPendingImportCommit({
      userId: 'u1',
      gaId: 1,
      importSessionId: 'sess',
      previewVersionHash: 'hash-a',
    })
    assert.throws(
      () => consumePendingImportCommit(pending.confirmationId, 'other', 1, 'hash-a'),
      (err) => err.code === 'CONFIRMATION_FORBIDDEN',
    )
    assert.throws(
      () => consumePendingImportCommit(pending.confirmationId, 'u1', 99, 'hash-a'),
      (err) => err.code === 'CONFIRMATION_FORBIDDEN',
    )
  })

  it('rejects stale preview hash', () => {
    const pending = createPendingImportCommit({
      userId: 'u1',
      gaId: 1,
      importSessionId: 'sess',
      previewVersionHash: 'hash-a',
    })
    assert.throws(
      () => consumePendingImportCommit(pending.confirmationId, 'u1', 1, 'hash-b'),
      (err) => err.code === 'STALE_PREVIEW',
    )
  })

  it('allows single consume', () => {
    const pending = createPendingImportCommit({
      userId: 'u1',
      gaId: 1,
      importSessionId: 'sess',
      previewVersionHash: 'hash-a',
    })
    const first = consumePendingImportCommit(pending.confirmationId, 'u1', 1, 'hash-a')
    assert.equal(first.confirmationId, pending.confirmationId)
    assert.throws(
      () => consumePendingImportCommit(pending.confirmationId, 'u1', 1, 'hash-a'),
      (err) => err.code === 'CONFIRMATION_ALREADY_USED',
    )
  })
})

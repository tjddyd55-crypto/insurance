import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import {
  assertAdminCanManageBoardWriters,
  signBoardWriterSessionToken,
} from './boardWriterAccountService.js'
import { BOARD_WRITER_JWT_KIND } from './boardWriterService.js'

test('assertAdminCanManageBoardWriters — global board requires super admin', () => {
  const board = { board_scope: 'global', owner_ga_id: null }
  assert.equal(assertAdminCanManageBoardWriters({ role: 'SUPER_ADMIN' }, board).ok, true)
  assert.equal(assertAdminCanManageBoardWriters({ role: 'GA_ADMIN', gaId: 1 }, board).ok, false)
})

test('assertAdminCanManageBoardWriters — ga board requires matching ga admin', () => {
  const board = { board_scope: 'ga', owner_ga_id: 7 }
  assert.equal(assertAdminCanManageBoardWriters({ role: 'GA_ADMIN', gaId: 7 }, board).ok, true)
  assert.equal(assertAdminCanManageBoardWriters({ role: 'GA_ADMIN', gaId: 8 }, board).ok, false)
  assert.equal(assertAdminCanManageBoardWriters({ role: 'SUPER_ADMIN' }, board).ok, false)
})

test('signBoardWriterSessionToken — encodes board writer kind', () => {
  const token = signBoardWriterSessionToken(
    {
      id: 'writer-1',
      login_id: 'writer001',
      writer_scope: 'global',
      owner_ga_id: null,
    },
    ['board-1'],
    'test-secret',
  )
  const decoded = jwt.verify(token, 'test-secret')
  assert.equal(decoded.kind, BOARD_WRITER_JWT_KIND)
  assert.equal(decoded.writerAccountId, 'writer-1')
  assert.equal(decoded.role, 'BOARD_WRITER')
  assert.deepEqual(decoded.allowedBoardIds, ['board-1'])
})

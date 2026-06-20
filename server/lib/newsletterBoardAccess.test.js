import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyNewsletterBoardAccess,
  isGaOnlyBoardSlugForTenant,
  pickAccessibleNewsletterBoard,
} from './newsletterBoardAccess.js'
import { normalizeNewsletterBoardSlug } from './newsletterBoardScope.js'

test('normalizeNewsletterBoardSlug lowercases and keeps hangul', () => {
  assert.equal(normalizeNewsletterBoardSlug('더도움노무사'), '더도움노무사')
  assert.equal(normalizeNewsletterBoardSlug(' Global Notice '), 'global-notice')
})

test('pickAccessibleNewsletterBoard prefers global when slug collides', () => {
  const globalBoard = { id: 'g1', slug: 'notice', board_scope: 'global', owner_ga_id: null }
  const gaBoard = { id: 'a1', slug: 'notice', board_scope: 'ga', owner_ga_id: 7 }
  const rows = [gaBoard, globalBoard]

  assert.equal(pickAccessibleNewsletterBoard(rows, 7)?.id, 'g1')
  assert.equal(pickAccessibleNewsletterBoard(rows, null)?.id, 'g1')
})

test('pickAccessibleNewsletterBoard allows ga owner only for ga board', () => {
  const gaBoard = { id: 'a1', slug: 'team', board_scope: 'ga', owner_ga_id: 7 }
  assert.equal(pickAccessibleNewsletterBoard([gaBoard], 7)?.id, 'a1')
  assert.equal(pickAccessibleNewsletterBoard([gaBoard], 3), null)
})

test('classifyNewsletterBoardAccess — public account on ga-only slug', () => {
  const gaBoard = { id: 'a1', slug: 'team', board_scope: 'ga', owner_ga_id: 7 }
  assert.equal(classifyNewsletterBoardAccess([gaBoard], 99), 'access_denied')
  assert.equal(isGaOnlyBoardSlugForTenant([gaBoard], 99), true)
})

test('classifyNewsletterBoardAccess — ga account on global slug', () => {
  const globalBoard = { id: 'g1', slug: 'notice', board_scope: 'global', owner_ga_id: null }
  assert.equal(classifyNewsletterBoardAccess([globalBoard], 7), null)
  assert.equal(pickAccessibleNewsletterBoard([globalBoard], 7)?.board_scope, 'global')
})

test('classifyNewsletterBoardAccess — missing slug', () => {
  assert.equal(classifyNewsletterBoardAccess([], 7), 'not_found')
})

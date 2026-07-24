import test from 'node:test'
import assert from 'node:assert/strict'
import { boardWriterCompanySlug, buildBoardWriterPostGaFilter, buildDynamicBoardPayload } from './boardWriterNewsletters.js'
import { buildDynamicBoardPostGaFilter } from './newsletterBoardScope.js'

test('boardWriterCompanySlug prefixes board slug', () => {
  assert.equal(boardWriterCompanySlug({ slug: 'notice' }), 'board-notice')
})

test('buildDynamicBoardPayload uses LOSS_ADJUSTER channel for system board', () => {
  const payload = buildDynamicBoardPayload(
    {
      slug: 'system-loss-adjuster',
      label: '손해사정사 소식지',
      board_scope: 'ga',
      owner_ga_id: 7,
      system_key: 'LOSS_ADJUSTER',
    },
    'writer-1',
    'PUBLISHED',
    undefined,
    {
      id: 'writer-1',
      name: '홍길동',
      organizationName: '영진',
      loginId: 'staff02',
    },
  )
  assert.equal(payload.newsChannel, 'LOSS_ADJUSTER')
  assert.equal(payload.insurerCode, 'LOSS_ADJUSTER')
  assert.equal(payload.dynamicBoardSlug, undefined)
  assert.equal(payload.publisherId, 'writer-1')
  assert.equal(payload.boardLabel, '손해사정사 소식지')
  assert.equal(payload.insurerName, '영진 · 홍길동')
  assert.equal(payload.authorDisplayName, '영진 · 홍길동')
  assert.notEqual(payload.insurerName, payload.boardLabel)
})

test('buildDynamicBoardPayload does not use board label as author', () => {
  const payload = buildDynamicBoardPayload(
    { slug: 'test', label: '테스트', board_scope: 'ga', owner_ga_id: 1 },
    'writer-1',
    'PUBLISHED',
    undefined,
    {
      id: 'writer-1',
      name: '홍길동',
      organizationName: '영진',
      loginId: 'staff02',
    },
  )
  assert.equal(payload.boardLabel, '테스트')
  assert.equal(payload.authorName, '홍길동')
  assert.equal(payload.authorOrganizationName, '영진')
  assert.equal(payload.authorDisplayName, '영진 · 홍길동')
  assert.equal(payload.insurerName, '영진 · 홍길동')
})

test('buildDynamicBoardPayload stores normalized linkPreview', () => {
  const payload = buildDynamicBoardPayload(
    { slug: 'notice', label: '공지', board_scope: 'global' },
    'writer-1',
    'PUBLISHED',
    {
      url: 'https://thedoum-counseling.co.kr/',
      title: '테스트',
      description: '설명',
    },
  )
  assert.equal(payload.linkPreview?.url, 'https://thedoum-counseling.co.kr/')
  assert.equal(payload.linkPreview?.title, '테스트')
})

test('buildDynamicBoardPayload works without linkPreview', () => {
  const payload = buildDynamicBoardPayload(
    { slug: 'notice', label: '공지', board_scope: 'global' },
    'writer-1',
    'PUBLISHED',
  )
  assert.equal(payload.dynamicBoardSlug, 'notice')
  assert.equal(payload.linkPreview, undefined)
})

test('buildDynamicBoardPayload clears linkPreview when input is null', () => {
  const payload = buildDynamicBoardPayload(
    { slug: 'notice', label: '공지', board_scope: 'global' },
    'writer-1',
    'PUBLISHED',
    null,
  )
  assert.equal(payload.linkPreview, undefined)
})

test('writer and portal read filters align for global and ga boards', () => {
  const globalBoard = { board_scope: 'global', slug: 'notice' }
  const gaBoard = { board_scope: 'ga', owner_ga_id: 12, slug: 'team' }

  assert.match(buildBoardWriterPostGaFilter(globalBoard, null).sql, /ga_id IS NULL/i)
  assert.match(buildDynamicBoardPostGaFilter(globalBoard, 5, 3).sql, /ga_id IS NULL/i)

  assert.deepEqual(buildBoardWriterPostGaFilter(gaBoard, 12).params, [12])
  assert.deepEqual(buildDynamicBoardPostGaFilter(gaBoard, 5, 3).params, [12])
})

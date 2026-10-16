import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AUTOSYNC_TITLES,
  autoSyncEventId,
  buildAutoSyncEventPayload,
  isAutoSyncEnabledFor,
  isOnefcAutoSyncCopy,
  isOwnedAutoSyncEvent,
  markTodoDeleted,
  markOffKinds,
} from './googleCalendarAutoSync.js'
import { normalizeGoogleCalendarEvent } from '../../schedule/scheduleEvents.js'

test('event id is deterministic, base32hex-safe and scoped by user/account/calendar/key', () => {
  const a = autoSyncEventId('u1', 'sub1', 'primary', 'todo:1')
  assert.equal(a, autoSyncEventId('u1', 'sub1', 'primary', 'todo:1'))
  assert.match(a, /^[0-9a-v]{5,1024}$/)
  assert.notEqual(a, autoSyncEventId('u2', 'sub1', 'primary', 'todo:1'))
  assert.notEqual(a, autoSyncEventId('u1', 'sub2', 'primary', 'todo:1'))
})

test('payload carries [type] name title and date only, never contact/RRN/memo/links', () => {
  const p = buildAutoSyncEventPayload({ key: 'reminder:car_expiry:7:9:2026-10-20', kind: 'car_expiry', date: '2026-10-20', completed: false, name: '홍길동' }, { ownerTag: 'o' })
  assert.equal(p.summary, '[자동차 만기] 홍길동')
  assert.deepEqual(p.start, { date: '2026-10-20' })
  assert.deepEqual(p.end, { date: '2026-10-21' })
  const text = JSON.stringify(p)
  assert.doesNotMatch(text, /http|010-|\d{6}-\d{7}/)
  assert.equal(p.extendedProperties.private.app, 'onefcAutoSync')
  const done = buildAutoSyncEventPayload({ key: 'todo:1', kind: 'todo', date: '2026-10-20', completed: true, name: '서류 준비' }, { ownerTag: 'o' })
  assert.equal(done.summary, '[할 일] 서류 준비 (완료)')
  assert.equal(buildAutoSyncEventPayload({ key: 'r', kind: 'insurance_age_date', date: '2026-10-20', name: '' }, { ownerTag: 'o' }).summary, '[상령일] 고객')
})

test('ownership is decided by private tags only', () => {
  const p = buildAutoSyncEventPayload({ key: 'todo:1', kind: 'todo', date: '2026-10-20' }, { ownerTag: 'o' })
  assert.equal(isOwnedAutoSyncEvent(p, 'o', 'todo:1'), true)
  assert.equal(isOwnedAutoSyncEvent(p, 'x', 'todo:1'), false)
  assert.equal(isOwnedAutoSyncEvent(p, 'o', 'todo:2'), false)
  assert.equal(isOwnedAutoSyncEvent({ summary: 'ONE FC 할 일', start: { date: '2026-10-20' } }, 'o'), false)
  assert.equal(isOnefcAutoSyncCopy({ summary: 'ONE FC 할 일' }), false)
})

test('schedule view hides ONE FC copies but keeps user events', () => {
  const copy = { id: 'e1', status: 'confirmed', start: { date: '2026-10-20' }, end: { date: '2026-10-21' }, extendedProperties: { private: { app: 'onefcAutoSync' } } }
  const mine = { id: 'e2', status: 'confirmed', summary: 'ONE FC 할 일', start: { date: '2026-10-20' }, end: { date: '2026-10-21' } }
  assert.equal(normalizeGoogleCalendarEvent(copy), null)
  assert.ok(normalizeGoogleCalendarEvent(mine))
})

test('flag requires autosync env AND write allowlist', () => {
  assert.equal(isAutoSyncEnabledFor('u1', { GOOGLE_WRITE_ENABLED: 'true' }), false)
  assert.equal(isAutoSyncEnabledFor('u1', { GOOGLE_WRITE_ENABLED: 'true', GOOGLE_CALENDAR_AUTOSYNC_ENABLED: 'true' }), true)
  assert.equal(isAutoSyncEnabledFor('u1', { GOOGLE_WRITE_ENABLED: 'true', GOOGLE_CALENDAR_AUTOSYNC_ENABLED: 'true', GOOGLE_WRITE_ALLOWED_USER_IDS: 'u2' }), false)
})

test('todo delete marks every mapped copy (past/today/future, incl. retained) for deletion; OFF rule keeps <= off date', async () => {
  const calls = []
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); return { rowCount: 3 } } }
  assert.equal(await markTodoDeleted(pool, 'u1', 42), 3)
  const { sql, params } = calls[0]
  assert.doesNotMatch(sql, /event_date/)
  assert.match(sql, /pending_delete/)
  assert.deepEqual(params.slice(0, 2), ['u1', 'todo:42'])
  assert.ok(params[2].includes('retained') && params[2].includes('active'))
  calls.length = 0
  await markOffKinds(pool, 'u1', ['todo'], '2026-10-16')
  assert.match(calls[0].sql, /event_date > \$3::date/)
  assert.match(calls[1].sql, /event_date <= \$3::date/)
})

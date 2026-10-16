import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AUTOSYNC_TITLES,
  autoSyncEventId,
  buildAutoSyncEventPayload,
  isAutoSyncEnabledFor,
  isOnefcAutoSyncCopy,
  isOwnedAutoSyncEvent,
} from './googleCalendarAutoSync.js'
import { normalizeGoogleCalendarEvent } from '../../schedule/scheduleEvents.js'

test('event id is deterministic, base32hex-safe and scoped by user/account/calendar/key', () => {
  const a = autoSyncEventId('u1', 'sub1', 'primary', 'todo:1')
  assert.equal(a, autoSyncEventId('u1', 'sub1', 'primary', 'todo:1'))
  assert.match(a, /^[0-9a-v]{5,1024}$/)
  assert.notEqual(a, autoSyncEventId('u2', 'sub1', 'primary', 'todo:1'))
  assert.notEqual(a, autoSyncEventId('u1', 'sub2', 'primary', 'todo:1'))
})

test('payload carries only generic title/date, never customer data', () => {
  const p = buildAutoSyncEventPayload({ key: 'reminder:car_expiry:7:9:2026-10-20', kind: 'car_expiry', date: '2026-10-20', completed: false }, { ownerTag: 'o' })
  assert.equal(p.summary, AUTOSYNC_TITLES.car_expiry)
  assert.deepEqual(p.start, { date: '2026-10-20' })
  assert.deepEqual(p.end, { date: '2026-10-21' })
  const text = JSON.stringify(p)
  assert.doesNotMatch(text, /http|010-|\d{6}-\d{7}/)
  assert.equal(p.extendedProperties.private.app, 'onefcAutoSync')
  const done = buildAutoSyncEventPayload({ key: 'todo:1', kind: 'todo', date: '2026-10-20', completed: true }, { ownerTag: 'o' })
  assert.equal(done.summary, 'ONE FC 할 일 (완료)')
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

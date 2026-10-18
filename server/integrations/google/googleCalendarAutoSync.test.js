import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AUTOSYNC_TITLES,
  autoSyncEventId,
  autoSyncTitle,
  autoSyncUpdateRequest,
  buildAutoSyncEventPayload,
  decideAutoSyncWrite,
  isAutoSyncEnabledFor,
  isOnefcAutoSyncCopy,
  isOwnedAutoSyncEvent,
  markTodoDeleted,
  markOffKinds,
  reminderEventToAutoSyncFields,
} from './googleCalendarAutoSync.js'
import { normalizeGoogleCalendarEvent } from '../../schedule/scheduleEvents.js'

test('event id is deterministic, base32hex-safe and scoped by user/account/calendar/key', () => {
  const a = autoSyncEventId('u1', 'sub1', 'primary', 'todo:1')
  assert.equal(a, autoSyncEventId('u1', 'sub1', 'primary', 'todo:1'))
  assert.match(a, /^[0-9a-v]{5,1024}$/)
  assert.notEqual(a, autoSyncEventId('u2', 'sub1', 'primary', 'todo:1'))
  assert.notEqual(a, autoSyncEventId('u1', 'sub2', 'primary', 'todo:1'))
})

test('titles that already include the customer name stay in bracket form', () => {
  assert.equal(autoSyncTitle({ kind: 'insurance_age_date', customerName: '홍길동', label: '상령일' }), '[상령일] 홍길동')
  assert.equal(autoSyncTitle({ kind: 'car_expiry', customerName: '홍길동', label: '자동차 만기' }), '[자동차 만기] 홍길동')
  assert.equal(autoSyncTitle({ kind: 'insurance_age_date', customerName: '', label: '' }), '[상령일] 고객')
  assert.equal(autoSyncTitle({ kind: 'special_date', customerName: '홍길동', label: '' }), '[알림일] 홍길동')
  assert.equal(autoSyncTitle({ kind: 'special_date', customerName: '홍길동', label: '알림일' }), '[알림일] 홍길동')
  assert.equal(autoSyncTitle({ kind: 'special_date', customerName: '홍길동', label: '홍길동 기념' }), '[알림일] 홍길동 기념')
  assert.equal(autoSyncTitle({ kind: 'todo', name: '서류 준비', completed: false }), '[할 일] 서류 준비')
  assert.equal(autoSyncTitle({ kind: 'todo', name: '서류 준비', completed: true }), '[할 일] 서류 준비 (완료)')
  assert.equal(AUTOSYNC_TITLES.todo, 'ONE FC 할 일')
})

test('custom alert labels without a customer name become "{name} {label}"', () => {
  assert.equal(autoSyncTitle({ kind: 'special_date', customerName: '홍길동', label: '결혼기념일' }), '홍길동 결혼기념일')
  assert.equal(autoSyncTitle({ kind: 'special_date', customerName: '김철수', label: '생일' }), '김철수 생일')
  assert.equal(autoSyncTitle({ kind: 'special_date', customerName: '이영희', label: '자동차보험 만기' }), '이영희 자동차보험 만기')
  assert.equal(autoSyncTitle({ kind: 'special_date', customerName: '박민수', label: '보험 갱신일' }), '박민수 보험 갱신일')
  assert.equal(autoSyncTitle({ kind: 'special_date', customerName: '홍길동', label: '알림 1' }), '홍길동 알림 1')
  assert.equal(autoSyncTitle({ kind: 'special_date', customerName: '  홍길동  ', label: '  결혼기념일  ' }), '홍길동 결혼기념일')
})

test('reminder fields keep named titles and prefix only unlabeled custom alerts', () => {
  const wedding = reminderEventToAutoSyncFields({ type: 'special_date', customerName: '홍길동', sourceTitle: '결혼기념일' })
  assert.equal(autoSyncTitle({ kind: 'special_date', ...wedding }), '홍길동 결혼기념일')
  const other = reminderEventToAutoSyncFields({ type: 'special_date', customerName: '김철수', sourceTitle: '결혼기념일' })
  assert.equal(autoSyncTitle({ kind: 'special_date', ...other }), '김철수 결혼기념일')
  const unnamed = reminderEventToAutoSyncFields({ type: 'special_date', customerName: '홍길동', sourceTitle: '알림일' })
  assert.equal(autoSyncTitle({ kind: 'special_date', ...unnamed }), '[알림일] 홍길동')
  const age = reminderEventToAutoSyncFields({ type: 'insurance_age_date', customerName: '홍길동', sourceTitle: '' })
  assert.equal(autoSyncTitle({ kind: 'insurance_age_date', ...age }), '[상령일] 홍길동')
  const car = reminderEventToAutoSyncFields({ type: 'car_expiry', customerName: '이영희', sourceTitle: '12가3456' })
  assert.equal(autoSyncTitle({ kind: 'car_expiry', ...car }), '[자동차 만기] 이영희')
  assert.equal(autoSyncTitle({ kind: 'car_expiry', ...car }).includes('12가'), false)
})

test('payload uses the title SSOT and does not put customer PII in description or metadata', () => {
  const item = {
    key: 'reminder:special_date:4:2026-10-20',
    kind: 'special_date',
    date: '2026-10-20',
    completed: false,
    customerName: '홍길동',
    label: '결혼기념일',
    phone: '010-1111-2222',
    ssn: '900101-1234567',
    medical: '고혈압',
    account: '110-123-456789',
  }
  const p = buildAutoSyncEventPayload(item, { ownerTag: 'o' })
  assert.equal(p.summary, '홍길동 결혼기념일')
  assert.equal(p.description, 'ONE FC 앱에서 자동으로 만든 일정입니다. 자세한 내용은 ONE FC에서 확인하세요.')
  assert.deepEqual(p.start, { date: '2026-10-20' })
  assert.deepEqual(p.end, { date: '2026-10-21' })
  assert.deepEqual(Object.keys(p.extendedProperties.private).sort(), ['app', 'key', 'kind', 'owner'])
  const rest = JSON.stringify({ description: p.description, extendedProperties: p.extendedProperties, start: p.start, end: p.end, reminders: p.reminders })
  assert.equal(rest.includes('홍길동'), false)
  assert.equal(rest.includes('010'), false)
  assert.equal(rest.includes('900101'), false)
  assert.equal(rest.includes('고혈압'), false)
  assert.equal(rest.includes('110-123'), false)
  assert.equal(p.extendedProperties.private.app, 'onefcAutoSync')
  const done = buildAutoSyncEventPayload({ key: 'todo:1', kind: 'todo', date: '2026-10-20', completed: true, name: '서류 준비' }, { ownerTag: 'o' })
  assert.equal(done.summary, '[할 일] 서류 준비 (완료)')
  assert.equal(buildAutoSyncEventPayload({ key: 'r', kind: 'insurance_age_date', date: '2026-10-20', customerName: '홍길동' }, { ownerTag: 'o' }).summary, '[상령일] 홍길동')
  const age = { key: 'r', kind: 'insurance_age_date', date: '2026-10-20', completed: false, customerName: '홍길동', label: '상령일' }
  const ageHash = decideAutoSyncWrite(undefined, age).hash
  assert.equal(decideAutoSyncWrite({ status: 'active', content_hash: ageHash, google_event_id: 'evt-age' }, age).action, 'skip')
})

test('title drift updates the mapped event id and patches summary only when the date is unchanged', () => {
  const item = {
    key: 'reminder:special_date:4:2026-10-20',
    kind: 'special_date',
    date: '2026-10-20',
    completed: false,
    customerName: '홍길동',
    label: '결혼기념일',
  }
  const stored = decideAutoSyncWrite(undefined, item)
  const map = { status: 'active', content_hash: stored.hash, google_event_id: 'evt-kept' }
  assert.equal(decideAutoSyncWrite(map, item).action, 'skip')
  const renamed = { ...item, customerName: '홍길순' }
  const renameDecision = decideAutoSyncWrite(map, renamed)
  assert.equal(renameDecision.action, 'update')
  assert.equal(renameDecision.eventId, 'evt-kept')
  const relabeled = decideAutoSyncWrite(map, { ...item, label: '생일' })
  assert.equal(relabeled.action, 'update')
  assert.equal(relabeled.eventId, 'evt-kept')
  const payload = buildAutoSyncEventPayload(renamed, { ownerTag: 'o' })
  assert.equal(payload.summary, '홍길순 결혼기념일')
  assert.deepEqual(payload.start, { date: '2026-10-20' })
  const titleOnly = autoSyncUpdateRequest({ start: { date: '2026-10-20' }, summary: '[알림일] 결혼기념일', reminders: { useDefault: true } }, payload)
  assert.equal(titleOnly.method, 'PATCH')
  assert.deepEqual(titleOnly.body, { summary: '홍길순 결혼기념일' })
  const dateChanged = autoSyncUpdateRequest({ start: { date: '2026-10-19' } }, payload)
  assert.equal(dateChanged.method, 'PUT')
  assert.equal(dateChanged.body.start.date, '2026-10-20')
  const todo = buildAutoSyncEventPayload({ key: 'todo:1', kind: 'todo', date: '2026-10-20', completed: false, name: '서류 준비' }, { ownerTag: 'o' })
  const todoWrite = autoSyncUpdateRequest({ start: { date: '2026-10-20' }, summary: '[할 일] 서류' }, todo)
  assert.equal(todoWrite.method, 'PUT')
  assert.equal(todoWrite.body.summary, '[할 일] 서류 준비')
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

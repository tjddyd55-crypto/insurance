import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { AUTOSYNC_KINDS } from '../../integrations/google/googleCalendarAutoSync.js'
import { SCHEDULE_SOURCES, scheduleFilterKey } from '../scheduleEvents.js'
import {
  ALERT_COPY_KINDS_KEPT,
  GOOGLE_SYNC_V2_DECISIONS,
  LOCAL_EVENT_FILTER_KEY,
  WIDGET_QUICK_ADD_ALL_DAY,
  calendarsToImport,
  disconnectRemovesLocalItems,
  itemsRetainedOnDisconnect,
} from './policy.js'

describe('google-sync-v2 승인 결정', () => {
  it('연결 해제는 Google 에서 가져온 일정을 포함한 로컬 항목을 지우지 않는다', () => {
    assert.equal(disconnectRemovesLocalItems(), false)
    assert.equal(GOOGLE_SYNC_V2_DECISIONS.disconnectKeepsImportedItems, true)
    const items = [
      { id: 'a', origin: 'onefc' },
      { id: 'b', origin: 'google_import' },
    ]
    assert.deepEqual(itemsRetainedOnDisconnect(items), items)
    const source = readFileSync(new URL('../../integrations/googleCalendarAdapter.js', import.meta.url), 'utf8')
    const start = source.indexOf('export async function disconnectGoogleForUser')
    const next = source.indexOf('\nexport ', start + 1)
    const body = source.slice(start, next === -1 ? undefined : next)
    assert.doesNotMatch(body, /calendar_items|sync_outbox|external_sync_links/)
  })

  it('만기·상령일·알림일 사본 종류는 기존 자동 연동에 남아 있다', () => {
    assert.equal(GOOGLE_SYNC_V2_DECISIONS.keepAlertCalendarCopies, true)
    for (const kind of ALERT_COPY_KINDS_KEPT) {
      assert.ok(AUTOSYNC_KINDS.includes(kind), kind)
    }
  })

  it('로컬 일정 필터 키는 기존 google 이고 새 출처 키를 추가하지 않는다', () => {
    assert.equal(LOCAL_EVENT_FILTER_KEY, 'google')
    assert.equal(scheduleFilterKey({ source: 'google', type: 'google_event' }), 'google')
    assert.equal(SCHEDULE_SOURCES.includes('google'), true)
    assert.equal(SCHEDULE_SOURCES.includes('onefc_event'), false)
  })

  it('import 는 화면에 선택된 캘린더만 대상으로 한다', () => {
    const calendars = [{ id: 'primary' }, { id: 'team' }, { id: 'other' }]
    assert.deepEqual(calendarsToImport(calendars, ['team']).map((item) => item.id), ['team'])
    assert.deepEqual(calendarsToImport(calendars, []), [])
    assert.deepEqual(calendarsToImport(calendars, ['missing']), [])
  })

  it('위젯 빠른 추가는 종일로 유지한다', () => {
    assert.equal(WIDGET_QUICK_ADD_ALL_DAY, true)
    assert.equal(GOOGLE_SYNC_V2_DECISIONS.widgetQuickAddAllDay, true)
  })
})

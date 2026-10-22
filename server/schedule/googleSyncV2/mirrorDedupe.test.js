import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { excludeMirroredGoogleEvents } from './mirrorDedupe.js'

const local = { id: 'local:1', localItemId: 'local-1', source: 'onefc_schedule', title: '상담' }
const mirror = { id: 'google:primary:g1', source: 'google', calendarId: 'primary', sourceId: 'g1', title: '상담' }
const other = { id: 'google:primary:g2', source: 'google', calendarId: 'primary', sourceId: 'g2', title: '다른 일정' }
const link = {
  provider: 'google_calendar',
  localType: 'calendar_item',
  status: 'active',
  localId: 'local-1',
  remoteContainerId: 'primary',
  remoteId: 'g1',
}

describe('로컬 일정과 Google 미러는 한 번만 센다', () => {
  it('목록에 로컬 항목이 있으면 같은 remote id 의 Google 이벤트는 빠진다', () => {
    const result = excludeMirroredGoogleEvents([local, mirror, other], [link])
    assert.deepEqual(result.map((event) => event.id), ['local:1', 'google:primary:g2'])
    assert.equal(result.length, 2)
    assert.notEqual(result.length, 3)
  })

  it('로컬 항목이 목록에 없으면 Google 이벤트를 숨기지 않는다', () => {
    const result = excludeMirroredGoogleEvents([mirror], [link])
    assert.deepEqual(result.map((event) => event.id), ['google:primary:g1'])
  })

  it('매핑이 없으면 둘 다 남는다', () => {
    const result = excludeMirroredGoogleEvents([local, mirror], [])
    assert.equal(result.length, 2)
  })
})

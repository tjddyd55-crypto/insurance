import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { GoogleAutoSyncState, UserAlertSettings } from '../api/notificationApi'
import { NotificationSettingsModal } from './NotificationSettingsModal'

const draft: UserAlertSettings = {
  insuranceAge: { enabled: true, daysBefore: 30 },
  carExpiry: { enabled: true, daysBefore: 30 },
  specialDate: { enabled: true, daysBefore: 0 },
  claimRequest: { enabled: true },
}

function google(enabled: boolean): GoogleAutoSyncState {
  return {
    available: true,
    connected: true,
    calendarWritable: true,
    accountEmail: 'advisor@example.com',
    enabled,
    kinds: { todo: true, car_expiry: true, insurance_age_date: true, special_date: true },
    lastSyncAt: null,
    lastSyncError: null,
    windowDays: 90,
  }
}

function html(enabled: boolean) {
  return renderToStaticMarkup(
    <NotificationSettingsModal
      open
      draft={draft}
      busy={false}
      error=""
      onChange={() => undefined}
      onSave={() => undefined}
      onCancel={() => undefined}
      google={google(enabled)}
      onGoogleChange={() => undefined}
    />,
  )
}

describe('Google 캘린더 자동 연동 고객 이름 안내', () => {
  it('자동 연동이 켜져 있을 때만 고객 이름 전송 안내를 보여 준다', () => {
    const on = html(true)
    const off = html(false)
    expect(on).toContain('data-testid="gcal-customer-name-notice"')
    expect(on).toContain('고객 이름이 연결된 본인 Google 캘린더 일정 제목으로 전송됩니다.')
    expect(on).toContain('홍길동 결혼기념일')
    expect(on).toContain('주민번호, 전화번호, 병력, 계좌번호는 보내지 않습니다.')
    expect(off).not.toContain('data-testid="gcal-customer-name-notice"')
    expect(off).not.toContain('고객 이름이 연결된 본인 Google 캘린더 일정 제목으로 전송됩니다.')
  })
})

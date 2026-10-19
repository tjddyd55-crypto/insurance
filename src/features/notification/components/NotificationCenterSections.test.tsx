import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { buildNotificationNavigatePath, type NotificationRow } from '../api/notificationApi'
import { NotificationCenterSections } from './NotificationCenterSections'

function row(partial: Partial<NotificationRow>): NotificationRow {
  return {
    id: '1',
    userId: 'user-a',
    gaId: 3,
    teamId: null,
    type: 'advisor_consultation_lead',
    referenceId: 'lead-a',
    message: '홍길동님의 상담 신청이 도착했습니다.',
    isRead: false,
    isDismissed: false,
    customerId: null,
    customerName: null,
    targetDate: null,
    claimRequestId: null,
    createdAt: '2026-10-19T00:00:00.000Z',
    ...partial,
  }
}

function renderSections(items: NotificationRow[]) {
  return renderToStaticMarkup(
    <NotificationCenterSections
      items={items}
      view="active"
      expandedSections={new Set()}
      pendingId={null}
      isConfirming={false}
      confirmTargetId={null}
      onNameClick={vi.fn()}
      onConfirm={vi.fn()}
      onToggleExpanded={vi.fn()}
    />,
  )
}

describe('상담 신청 알림 섹션', () => {
  it('저장된 문구와 신청일을 보여주고 빈 고객 이름은 그리지 않는다', () => {
    const lead = row({})
    const html = renderSections([
      lead,
      row({
        id: '9',
        type: 'customer_created',
        message: '목록에 있으면 안 되는 타입',
        customerName: '숨김고객',
      }),
    ])

    expect(html).toContain('상담 신청')
    expect(html).toContain('신청일')
    expect(html).toContain('홍길동님의 상담 신청이 도착했습니다.')
    expect(html).toContain('2026-10-19')
    expect(html).not.toContain('숨김고객')
    expect(html).not.toContain('목록에 있으면 안 되는 타입')
    expect(html).toContain('notification-section--consultation')
    expect(buildNotificationNavigatePath(lead)).toBe('/consultation-leads?lead=lead-a')
  })

  it('message 가 비어 있으면 신청자 이름 문장으로 폴백하고 빈 이름은 대시로 두지 않는다', () => {
    const html = renderSections([
      row({
        message: '   ',
        visitorName: '김상담',
      } as Partial<NotificationRow>),
    ])
    expect(html).toContain('김상담님의 상담 신청이 도착했습니다.')
    expect(html).not.toContain('>—<')
  })
})

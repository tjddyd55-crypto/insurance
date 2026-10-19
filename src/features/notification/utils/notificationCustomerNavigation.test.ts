import { describe, expect, it, vi } from 'vitest'
import {
  buildNotificationNavigatePath,
  notificationTypeLabel,
  type NotificationRow,
} from '../api/notificationApi'
import {
  canNavigateFromNotification,
  openNotificationNavigate,
} from './notificationCustomerNavigation'

function row(partial: Partial<NotificationRow>): NotificationRow {
  return {
    id: 'n1',
    userId: 'u1',
    gaId: 1,
    teamId: null,
    type: 'customer_created',
    referenceId: null,
    message: '알림',
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

describe('openNotificationNavigate', () => {
  it('상담 신청은 리드 상세로 가고 고객 화면으로 가지 않는다', () => {
    const navigate = vi.fn()
    const ok = openNotificationNavigate({
      notification: row({
        type: 'advisor_consultation_lead',
        referenceId: 'lead-1',
        customerId: 647,
      }),
      navigate,
      isMobile: false,
    })
    expect(ok).toBe(true)
    expect(navigate).toHaveBeenCalledWith('/consultation-leads?lead=lead-1')
  })

  it('리드 id가 없으면 상담 신청 알림은 이동하지 않는다', () => {
    const navigate = vi.fn()
    const ok = openNotificationNavigate({
      notification: row({ type: 'advisor_consultation_lead', referenceId: '  ' }),
      navigate,
      isMobile: false,
    })
    expect(ok).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('기존 고객 알림은 고객 작업 경로로 간다', () => {
    const navigate = vi.fn()
    const ok = openNotificationNavigate({
      notification: row({
        type: 'customer_created',
        customerId: 647,
        customerName: '홍길동',
      }),
      navigate,
      isMobile: false,
    })
    expect(ok).toBe(true)
    expect(navigate).toHaveBeenCalledWith(
      '/customers/647/consultations?customerId=647',
      expect.objectContaining({
        state: expect.objectContaining({ expandCustomerId: 647, customerName: '홍길동' }),
      }),
    )
  })

  it('고객 id가 없는 기존 알림은 열 수 없다', () => {
    expect(canNavigateFromNotification(row({ type: 'special_date', customerId: null }))).toBe(false)
    expect(canNavigateFromNotification(row({ type: 'advisor_consultation_lead', referenceId: 'abc' }))).toBe(
      true,
    )
  })
})

describe('buildNotificationNavigatePath', () => {
  it('상담 신청은 리드 쿼리로 가고 고객 id가 없어도 경로가 있다', () => {
    expect(
      buildNotificationNavigatePath(
        row({ type: 'advisor_consultation_lead', referenceId: 'lead-1', customerId: null }),
      ),
    ).toBe('/consultation-leads?lead=lead-1')
    expect(notificationTypeLabel('advisor_consultation_lead')).toBe('상담 신청')
  })

  it('기존 고객 알림은 고객 id가 없으면 null이다', () => {
    expect(buildNotificationNavigatePath(row({ type: 'special_date', customerId: null }))).toBe(null)
    expect(
      buildNotificationNavigatePath(row({ type: 'customer_created', customerId: 647 })),
    ).toBe('/customers/647/consultations')
  })
})

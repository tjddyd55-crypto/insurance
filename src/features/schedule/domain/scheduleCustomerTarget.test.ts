import { describe, expect, it } from 'vitest'
import { customerTargetOfEvent, customerTargetOfTask, scheduleCustomerEmbedSrc } from './scheduleCustomerTarget'
import type { ScheduleEvent, ScheduleTask } from '../api/scheduleApi'

const ev = (patch: Partial<ScheduleEvent>) => ({ source: 'crm', type: 'customer_alert', customerId: 7, customerName: '홍길동', title: '홍길동 생일', ...patch }) as ScheduleEvent
const task = (patch: Partial<ScheduleTask>) => ({ source: 'onefc_todo', customerId: 7, customerName: '홍길동', title: '전화', ...patch }) as ScheduleTask

describe('고객 연결 판별(실제 customerId 만)', () => {
  it('CRM 알림일·상령일 → 상담 이력 탭, 자동차 만기 → 자동차 탭', () => {
    expect(customerTargetOfEvent(ev({}))).toMatchObject({ customerId: 7, tab: 'consultations' })
    expect(customerTargetOfEvent(ev({ type: 'insurance_age' }))).toMatchObject({ customerId: 7, tab: 'consultations' })
    expect(customerTargetOfEvent(ev({ type: 'car_expiry' }))).toMatchObject({ customerId: 7, tab: 'auto-form' })
  })
  it('Google 일정·customerId 없는 일정은 고객 팝업 대상이 아니다(이름이 같아도)', () => {
    expect(customerTargetOfEvent(ev({ source: 'google', type: 'google_event', customerId: null }))).toBeNull()
    expect(customerTargetOfEvent(ev({ customerId: null }))).toBeNull()
  })
  it('고객 연결 ONE FC 할 일만 대상, Google 할 일은 아님', () => {
    expect(customerTargetOfTask(task({}))).toMatchObject({ customerId: 7 })
    expect(customerTargetOfTask(task({ customerId: null }))).toBeNull()
    expect(customerTargetOfTask(task({ source: 'google_task', customerId: null }))).toBeNull()
  })
  it('팝업 주소는 기존 고객 상세 경로 + 임베드 표시', () => {
    expect(scheduleCustomerEmbedSrc({ customerId: 7, tab: 'auto-form' })).toBe('/customers/7/auto-form?customerId=7&embed=customer')
  })
})

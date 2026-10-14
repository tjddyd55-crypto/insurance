import type { ScheduleEvent, ScheduleTask } from '../api/scheduleApi'

/** 일정 관리(PC)에서 고객 연결 일정·할 일을 눌렀을 때 여는 고객 상세 대상. customerId 는 서버가 준 실제 연결 id 만. */
export type ScheduleCustomerTarget = {
  customerId: number
  /** 처음 보여 줄 우측 탭 경로(기존 이동 규칙과 같다: 자동차 만기 → auto-form, 그 밖 → consultations) */
  tab: 'consultations' | 'auto-form'
  /** 팝업 제목 옆에 보일 일정 제목 */
  title: string
  customerName: string
}

/** 고객에 실제로 연결된(서버가 준 customerId) CRM 일정 → 고객 상세 대상. 이름으로 찾지 않는다. */
export function customerTargetOfEvent(event: ScheduleEvent): ScheduleCustomerTarget | null {
  if (event.source !== 'crm' || !event.customerId || event.customerId < 1) return null
  return {
    customerId: event.customerId,
    tab: event.type === 'car_expiry' ? 'auto-form' : 'consultations',
    title: event.title,
    customerName: event.customerName,
  }
}

/** 고객에 연결된 ONE FC 할 일 → 고객 상세 대상. Google 할 일은 고객 연결이 없다. */
export function customerTargetOfTask(task: ScheduleTask): ScheduleCustomerTarget | null {
  if (task.source !== 'onefc_todo' || !task.customerId || task.customerId < 1) return null
  return { customerId: task.customerId, tab: 'consultations', title: task.title, customerName: task.customerName }
}


/** 팝업 iframe 주소: 기존 고객 상세 경로 + 임베드 표시 */
export function scheduleCustomerEmbedSrc(target: Pick<ScheduleCustomerTarget, 'customerId' | 'tab'>): string {
  const query = new URLSearchParams({ customerId: String(target.customerId), embed: 'customer' })
  return `/customers/${target.customerId}/${target.tab}?${query.toString()}`
}

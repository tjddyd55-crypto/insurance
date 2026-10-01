import { resolveCustomerNameSnapshot } from './normalizeConsultation'
import type { CoverageScenario } from './types'

/** Consultation에만 저장. Template에는 customer 필드 없음. */
export type ConsultationCustomerDraft = {
  customerId: string | null
  customerNameSnapshot: string | null
}

export type CoverageSimulatorCustomerListItem = {
  id: string
  name: string
  phone?: string
  /** customers.birth_date → API `birthDate` (YYYY-MM-DD). 없으면 생략 */
  birthDate?: string
  /** 목록/검색 응답에 이미 있는 주민번호. 생년월일 표시 fallback 전용 */
  ssn?: string
}

export function emptyCustomerDraft(): ConsultationCustomerDraft {
  return { customerId: null, customerNameSnapshot: null }
}

export function customerDraftFromSelection(
  item: CoverageSimulatorCustomerListItem | null,
): ConsultationCustomerDraft {
  if (!item) return emptyCustomerDraft()
  return { customerId: item.id, customerNameSnapshot: item.name }
}

export function customerDisplayLabel(draft: ConsultationCustomerDraft): string {
  if (draft.customerId && draft.customerNameSnapshot) {
    return `${draft.customerNameSnapshot} 고객`
  }
  return '고객 미지정'
}

/** 저장된 상담을 다시 열 때 에디터가 보여줄 고객. 세션 draft 는 읽지 않는다. */
export function consultationCustomerFromScenario(
  scenario: Pick<CoverageScenario, 'customerId' | 'customerNameSnapshot' | 'customerName'>,
): ConsultationCustomerDraft {
  return {
    customerId: scenario.customerId ?? null,
    customerNameSnapshot: resolveCustomerNameSnapshot(scenario),
  }
}

/**
 * 에디터에서 고객을 고르거나 지울 때만 호출한다.
 * id 와 이름 스냅샷을 함께 기록한다. 둘 다 비면 연결 해제다.
 */
export function applyConsultationCustomer(
  scenario: CoverageScenario,
  draft: ConsultationCustomerDraft,
): CoverageScenario {
  const customerId = draft.customerId?.trim() ? draft.customerId.trim() : null
  const customerNameSnapshot = draft.customerNameSnapshot?.trim()
    ? draft.customerNameSnapshot.trim()
    : null
  return {
    ...scenario,
    customerId,
    customerNameSnapshot,
    customerName: customerNameSnapshot ?? undefined,
  }
}

/**
 * 헤더 저장 payload. 세션 고객(다음 상담용)을 섞지 않고
 * 지금 시나리오에 있는 고객만 유지한다.
 */
export function consultationSavePayload<T extends CoverageScenario>(scenario: T, title: string): T {
  return applyConsultationCustomer(
    { ...scenario, title },
    consultationCustomerFromScenario(scenario),
  ) as T
}

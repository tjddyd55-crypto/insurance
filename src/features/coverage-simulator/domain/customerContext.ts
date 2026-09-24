/** Consultation에만 저장. Template에는 customer 필드 없음. */
export type ConsultationCustomerDraft = {
  customerId: string | null
  customerNameSnapshot: string | null
}

export type CoverageSimulatorCustomerListItem = {
  id: string
  name: string
  phone?: string
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

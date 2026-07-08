import type { CustomerSpecialDateFormItem } from '../types/customerSpecialDateForm'
import {
  createCustomerSpecialDate,
  deleteCustomerSpecialDate,
  listCustomerSpecialDates,
  updateCustomerSpecialDate,
  type CustomerSpecialDateInput,
  type CustomerSpecialDateRecord,
} from '../api/customerSpecialDatesApi'
import { normalizeCustomerSpecialDatesForSave } from './customerSpecialDateFormUtils'
import { normalizeCustomerSpecialDatePurposeType } from '../config/customerSpecialDatePurpose.config'

export function customerSpecialDateRecordToFormItem(
  r: CustomerSpecialDateRecord,
): CustomerSpecialDateFormItem {
  return {
    id: r.id,
    purposeType: r.purposeType,
    title: r.title ?? '',
    dateValue: r.dateValue ? String(r.dateValue).slice(0, 10) : '',
    memo: r.memo ?? '',
  }
}

function trim(s: string | undefined): string {
  return String(s ?? '').trim()
}

function formItemToInput(item: CustomerSpecialDateFormItem): CustomerSpecialDateInput {
  return {
    // 타입이 비어 있거나 유효하지 않으면 CELEBRATION으로 보정 → 빈 타입 400 방지.
    purposeType: normalizeCustomerSpecialDatePurposeType(item.purposeType),
    title: trim(item.title),
    dateValue: trim(item.dateValue).slice(0, 10),
    memo: trim(item.memo),
  }
}

function recordEqualsForm(rec: CustomerSpecialDateRecord, item: CustomerSpecialDateFormItem): boolean {
  const rDate = rec.dateValue ? String(rec.dateValue).slice(0, 10) : ''
  return (
    rec.purposeType === item.purposeType &&
    trim(rec.title) === trim(item.title) &&
    rDate === trim(item.dateValue).slice(0, 10) &&
    trim(rec.memo) === trim(item.memo)
  )
}

/**
 * customer_special_dates 테이블을 폼 상태와 일치시킨다. 고객 기본정보 저장 이후 호출.
 */
export async function saveCustomerSpecialDatesForCustomer(params: {
  token: string
  customerId: number
  formItems: CustomerSpecialDateFormItem[]
}): Promise<void> {
  const { token, customerId, formItems } = params
  const norm = normalizeCustomerSpecialDatesForSave(formItems)
  const current = await listCustomerSpecialDates(token, customerId)

  if (norm.length === 0) {
    for (const r of current) {
      await deleteCustomerSpecialDate(token, customerId, r.id)
    }
    return
  }

  const formIds = new Set(
    norm.map((item) => item.id).filter((id): id is number => id != null && Number.isInteger(id) && id > 0),
  )

  for (const r of current) {
    if (!formIds.has(r.id)) {
      await deleteCustomerSpecialDate(token, customerId, r.id)
    }
  }

  const afterDelete = await listCustomerSpecialDates(token, customerId)
  const freshById = new Map(afterDelete.map((r) => [r.id, r]))

  for (const item of norm) {
    if (item.id != null && freshById.has(item.id)) {
      const rec = freshById.get(item.id)!
      if (!recordEqualsForm(rec, item)) {
        await updateCustomerSpecialDate(token, customerId, item.id, formItemToInput(item))
      }
      continue
    }
    await createCustomerSpecialDate(token, customerId, formItemToInput(item))
  }
}

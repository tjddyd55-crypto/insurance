import type { CustomerCustomFieldFormItem } from '../types/customerCustomFieldForm'
import {
  createCustomerCustomField,
  deleteCustomerCustomField,
  listCustomerCustomFields,
  updateCustomerCustomField,
  type CustomerCustomFieldInput,
  type CustomerCustomFieldRecord,
} from '../api/customerCustomFieldsApi'
import { normalizeCustomerCustomFieldsForSave } from './customerCustomFieldFormUtils'

export function customerCustomFieldRecordToFormItem(
  r: CustomerCustomFieldRecord,
): CustomerCustomFieldFormItem {
  return {
    id: r.id,
    label: r.label ?? '',
    value: r.value ?? '',
  }
}

function trim(s: string | undefined): string {
  return String(s ?? '').trim()
}

function formItemToInput(item: CustomerCustomFieldFormItem, sortOrder: number): CustomerCustomFieldInput {
  return {
    label: trim(item.label),
    value: trim(item.value),
    sortOrder,
  }
}

function recordEqualsForm(rec: CustomerCustomFieldRecord, item: CustomerCustomFieldFormItem, sortOrder: number): boolean {
  return (
    trim(rec.label) === trim(item.label) &&
    trim(rec.value) === trim(item.value) &&
    rec.sortOrder === sortOrder
  )
}

/**
 * customer_custom_fields 테이블을 폼 상태와 일치시킨다. 고객 기본정보 저장 이후 호출.
 */
export async function saveCustomerCustomFieldsForCustomer(params: {
  token: string
  customerId: number
  formItems: CustomerCustomFieldFormItem[]
}): Promise<void> {
  const { token, customerId, formItems } = params
  const norm = normalizeCustomerCustomFieldsForSave(formItems).map((item, index) => ({
    ...item,
    sortOrder: index,
  }))
  const current = await listCustomerCustomFields(token, customerId)

  if (norm.length === 0) {
    for (const r of current) {
      await deleteCustomerCustomField(token, customerId, r.id)
    }
    return
  }

  const formIds = new Set(
    norm.map((item) => item.id).filter((id): id is number => id != null && Number.isInteger(id) && id > 0),
  )

  for (const r of current) {
    if (!formIds.has(r.id)) {
      await deleteCustomerCustomField(token, customerId, r.id)
    }
  }

  const afterDelete = await listCustomerCustomFields(token, customerId)
  const freshById = new Map(afterDelete.map((r) => [r.id, r]))

  for (const item of norm) {
    const sortOrder = item.sortOrder ?? 0
    if (item.id != null && freshById.has(item.id)) {
      const rec = freshById.get(item.id)!
      if (!recordEqualsForm(rec, item, sortOrder)) {
        await updateCustomerCustomField(token, customerId, item.id, formItemToInput(item, sortOrder))
      }
      continue
    }
    await createCustomerCustomField(token, customerId, formItemToInput(item, sortOrder))
  }
}

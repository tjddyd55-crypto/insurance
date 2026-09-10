import type { CustomerFireInsuranceLocationFormItem } from '../types/customerFireInsuranceLocationForm'
import {
  createCustomerFireInsuranceLocation,
  deleteCustomerFireInsuranceLocation,
  listCustomerFireInsuranceLocations,
  updateCustomerFireInsuranceLocation,
  type CustomerFireInsuranceLocationInput,
  type CustomerFireInsuranceLocationRecord,
} from '../api/customerFireInsuranceLocationsApi'
import { normalizeCustomerFireInsuranceLocationsForSave } from './customerFireInsuranceLocationFormUtils'

export function customerFireInsuranceLocationRecordToFormItem(
  r: CustomerFireInsuranceLocationRecord,
): CustomerFireInsuranceLocationFormItem {
  return {
    id: r.id,
    address: r.address ?? '',
    memo: r.memo ?? '',
  }
}

function trim(s: string | undefined): string {
  return String(s ?? '').trim()
}

function formItemToInput(item: CustomerFireInsuranceLocationFormItem): CustomerFireInsuranceLocationInput {
  return {
    address: trim(item.address),
    memo: trim(item.memo),
  }
}

function recordEqualsForm(
  rec: CustomerFireInsuranceLocationRecord,
  item: CustomerFireInsuranceLocationFormItem,
): boolean {
  return trim(rec.address) === trim(item.address) && trim(rec.memo) === trim(item.memo)
}

export async function saveCustomerFireInsuranceLocationsForCustomer(params: {
  token: string
  customerId: number
  formItems: CustomerFireInsuranceLocationFormItem[]
}): Promise<void> {
  const { token, customerId, formItems } = params
  const norm = normalizeCustomerFireInsuranceLocationsForSave(formItems)
  const current = await listCustomerFireInsuranceLocations(token, customerId)

  if (norm.length === 0) {
    for (const r of current) {
      await deleteCustomerFireInsuranceLocation(token, customerId, r.id)
    }
    return
  }

  const formIds = new Set(
    norm.map((item) => item.id).filter((id): id is number => id != null && Number.isInteger(id) && id > 0),
  )

  for (const r of current) {
    if (!formIds.has(r.id)) {
      await deleteCustomerFireInsuranceLocation(token, customerId, r.id)
    }
  }

  const afterDelete = await listCustomerFireInsuranceLocations(token, customerId)
  const freshById = new Map(afterDelete.map((r) => [r.id, r]))

  for (const item of norm) {
    if (item.id != null && freshById.has(item.id)) {
      const rec = freshById.get(item.id)!
      if (!recordEqualsForm(rec, item)) {
        await updateCustomerFireInsuranceLocation(token, customerId, item.id, formItemToInput(item))
      }
      continue
    }
    await createCustomerFireInsuranceLocation(token, customerId, formItemToInput(item))
  }
}

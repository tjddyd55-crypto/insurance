import type { CustomerCarFormItem } from '../types/customerCarForm'
import type { CustomerCustomFieldFormItem } from '../types/customerCustomFieldForm'
import type { CustomerFireInsuranceLocationFormItem } from '../types/customerFireInsuranceLocationForm'
import type { CustomerSpecialDateFormItem } from '../types/customerSpecialDateForm'
import { parseCustomerSpecialDatePurposeFromExcel } from '../config/customerSpecialDatePurpose.config'
import type {
  CustomerExcelCarRow,
  CustomerExcelCustomFieldRow,
  CustomerExcelFireLocationRow,
  CustomerExcelRelatedSheets,
  CustomerExcelSpecialDateRow,
} from '../config/customerExcelFullProfileSsot'
import { saveCustomerCarsForCustomer } from './customerCarsSaveUtils'
import { saveCustomerCustomFieldsForCustomer } from './customerCustomFieldsSaveUtils'
import { saveCustomerFireInsuranceLocationsForCustomer } from './customerFireInsuranceLocationsSaveUtils'
import { saveCustomerSpecialDatesForCustomer } from './customerSpecialDatesSaveUtils'

export type CustomerExcelRelatedSaveFailure = {
  importKey: string
  customerId: number
  section: 'cars' | 'specialDates' | 'customFields' | 'fireInsurance'
  message: string
}

function carRowsToFormItems(rows: CustomerExcelCarRow[]): CustomerCarFormItem[] {
  return rows.map((r, idx) => ({
    carNumber: r.carNumber,
    carModel: r.carModel,
    carYear: r.carYear,
    renewalDate: r.renewalDate,
    carType: r.carType,
    memo: r.memo,
    isPrimary: r.isPrimary || (idx === 0 && rows.length === 1),
  }))
}

function specialDateRowsToFormItems(rows: CustomerExcelSpecialDateRow[]): CustomerSpecialDateFormItem[] {
  return rows.map((r) => ({
    purposeType: parseCustomerSpecialDatePurposeFromExcel(r.purposeTypeRaw),
    title: r.title,
    dateValue: r.dateValue,
    memo: r.memo,
  }))
}

function customFieldRowsToFormItems(rows: CustomerExcelCustomFieldRow[]): CustomerCustomFieldFormItem[] {
  return rows.map((r) => ({
    label: r.label,
    value: r.value,
  }))
}

function fireRowsToFormItems(rows: CustomerExcelFireLocationRow[]): CustomerFireInsuranceLocationFormItem[] {
  return rows.map((r) => ({
    address: r.address,
    memo: r.memo,
  }))
}

export function groupRelatedByImportKey(
  related: CustomerExcelRelatedSheets,
): Map<string, CustomerExcelRelatedSheets> {
  const map = new Map<string, CustomerExcelRelatedSheets>()
  const ensure = (key: string): CustomerExcelRelatedSheets => {
    const existing = map.get(key)
    if (existing) {
      return existing
    }
    const empty: CustomerExcelRelatedSheets = {
      cars: [],
      specialDates: [],
      customFields: [],
      fireLocations: [],
    }
    map.set(key, empty)
    return empty
  }
  for (const row of related.cars) {
    ensure(row.importKey).cars.push(row)
  }
  for (const row of related.specialDates) {
    ensure(row.importKey).specialDates.push(row)
  }
  for (const row of related.customFields) {
    ensure(row.importKey).customFields.push(row)
  }
  for (const row of related.fireLocations) {
    ensure(row.importKey).fireLocations.push(row)
  }
  return map
}

export async function saveCustomerExcelRelatedEntities(params: {
  token: string
  customerId: number
  importKey: string
  related: CustomerExcelRelatedSheets
}): Promise<CustomerExcelRelatedSaveFailure[]> {
  const { token, customerId, importKey, related } = params
  const failures: CustomerExcelRelatedSaveFailure[] = []

  if (related.cars.length > 0) {
    try {
      await saveCustomerCarsForCustomer({
        token,
        customerId,
        formCars: carRowsToFormItems(related.cars),
      })
    } catch (e: unknown) {
      failures.push({
        importKey,
        customerId,
        section: 'cars',
        message: e instanceof Error ? e.message : '자동차 저장 실패',
      })
    }
  }

  if (related.specialDates.length > 0) {
    try {
      await saveCustomerSpecialDatesForCustomer({
        token,
        customerId,
        formItems: specialDateRowsToFormItems(related.specialDates),
      })
    } catch (e: unknown) {
      failures.push({
        importKey,
        customerId,
        section: 'specialDates',
        message: e instanceof Error ? e.message : '알림일 저장 실패',
      })
    }
  }

  if (related.customFields.length > 0) {
    try {
      await saveCustomerCustomFieldsForCustomer({
        token,
        customerId,
        formItems: customFieldRowsToFormItems(related.customFields),
      })
    } catch (e: unknown) {
      failures.push({
        importKey,
        customerId,
        section: 'customFields',
        message: e instanceof Error ? e.message : '추가정보 저장 실패',
      })
    }
  }

  if (related.fireLocations.length > 0) {
    try {
      await saveCustomerFireInsuranceLocationsForCustomer({
        token,
        customerId,
        formItems: fireRowsToFormItems(related.fireLocations),
      })
    } catch (e: unknown) {
      failures.push({
        importKey,
        customerId,
        section: 'fireInsurance',
        message: e instanceof Error ? e.message : '화재보험 소재지 저장 실패',
      })
    }
  }

  return failures
}

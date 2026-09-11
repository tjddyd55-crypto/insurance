import { normalizeCustomerCarrierForForm } from '../config/customerMobileCarrier.config'
import type { CustomerEditFormState } from '../types/customerEditForm'
import { normalizeCustomerCarsForSave } from './customerCarFormUtils'
import {
  ensureCustomerFireInsuranceLocationFormItems,
  normalizeCustomerFireInsuranceLocationsForSave,
} from './customerFireInsuranceLocationFormUtils'
import { normalizeBirthDateForSaveApi } from './customerEditFormState'
import { normalizePhoneForCustomerDedupe } from './customerSearchDedupe'

function trim(value: string | null | undefined): string {
  return String(value ?? '').trim()
}

/** 편집 draft / baseline 비교용 — nested reference 공유 없이 복제 */
export function cloneCustomerEditFormState(form: CustomerEditFormState): CustomerEditFormState {
  return {
    ...form,
    cars: form.cars.map((car) => ({ ...car })),
    businessInfo: { ...form.businessInfo },
    fireInsuranceLocations: form.fireInsuranceLocations.map((row) => ({ ...row })),
    specialDates: form.specialDates.map((row) => ({ ...row })),
    crmExtensionFields: { ...form.crmExtensionFields },
  }
}

function normalizeSpecialDatesForDirtyCompare(
  items: CustomerEditFormState['specialDates'],
): CustomerEditFormState['specialDates'] {
  return items
    .map((item) => ({
      id: item.id,
      purposeType: item.purposeType,
      title: trim(item.title),
      dateValue: trim(item.dateValue).slice(0, 10),
      memo: trim(item.memo),
    }))
    .filter((item) => item.title || item.dateValue || item.memo)
    .sort((a, b) => {
      const idA = a.id ?? ''
      const idB = b.id ?? ''
      if (idA !== idB) {
        return String(idA).localeCompare(String(idB))
      }
      return a.title.localeCompare(b.title, 'ko')
    })
}

/** dirty 비교용 정규화 — 저장 API 와 동일한 empty/null 규칙을 최대한 따른다 */
export function normalizeCustomerEditFormForDirtyCompare(
  form: CustomerEditFormState,
): CustomerEditFormState {
  const birthDate = normalizeBirthDateForSaveApi(form.birthDate)
  return {
    ...form,
    name: trim(form.name),
    gender: form.gender ?? null,
    ssn: trim(form.ssn),
    phone: normalizePhoneForCustomerDedupe(form.phone),
    carrier: normalizeCustomerCarrierForForm(form.carrier),
    birthDate: birthDate ?? '',
    address: trim(form.address),
    addressDetail: trim(form.addressDetail),
    zonecode: trim(form.zonecode),
    height: trim(form.height),
    weight: trim(form.weight),
    job: trim(form.job),
    isDriver: form.isDriver === true ? true : form.isDriver === false ? false : null,
    carType: trim(form.carType),
    treatmentHistoryNote: trim(form.treatmentHistoryNote),
    medicationHistoryNote: trim(form.medicationHistoryNote),
    insuranceHistory: trim(form.insuranceHistory),
    accountNumber: trim(form.accountNumber),
    cars: normalizeCustomerCarsForSave(form.cars).map((car) => ({
      ...car,
      carNumber: trim(car.carNumber),
      carModel: trim(car.carModel),
      carYear: trim(car.carYear).replace(/\D/g, ''),
      renewalDate: trim(car.renewalDate).slice(0, 10),
      carType: trim(car.carType),
      memo: trim(car.memo),
      isPrimary: car.isPrimary === true,
    })),
    businessInfo: {
      representativeName: trim(form.businessInfo.representativeName),
      businessNumber: trim(form.businessInfo.businessNumber),
      businessAddress: trim(form.businessInfo.businessAddress),
      memo: trim(form.businessInfo.memo),
    },
    fireInsuranceLocations: normalizeCustomerFireInsuranceLocationsForSave(
      ensureCustomerFireInsuranceLocationFormItems(form.fireInsuranceLocations),
    ),
    specialDates: normalizeSpecialDatesForDirtyCompare(form.specialDates),
    crmExtensionFields: Object.fromEntries(
      Object.entries(form.crmExtensionFields)
        .map(([key, value]) => [key, trim(value)])
        .filter(([, value]) => value.length > 0)
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
    inflowSource: trim(form.inflowSource),
    referrerName: trim(form.referrerName),
    smsOptOut: form.smsOptOut === true,
  }
}

export function isCustomerEditFormDirty(
  baseline: CustomerEditFormState,
  current: CustomerEditFormState,
): boolean {
  const left = normalizeCustomerEditFormForDirtyCompare(baseline)
  const right = normalizeCustomerEditFormForDirtyCompare(current)
  return JSON.stringify(left) !== JSON.stringify(right)
}

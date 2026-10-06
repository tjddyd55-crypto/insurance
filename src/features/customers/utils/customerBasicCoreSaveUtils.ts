import { formatAddressForSave, parseAddressFromStored } from '../../../components/form'
import { updateCustomer } from '../api/customersApi'
import { resolveReferrerNameForSave } from '../config/customerInflowSource.config'
import { normalizeCustomerCarrierForSave } from '../config/customerMobileCarrier.config'
import type { CustomerRecord } from '../domain/types'
import { normalizeCustomerNotesBag } from '../domain/types'
import { buildLegacyMedicalColumnValue } from './customerMedicalHistory'
import { normalizeBirthDateForSaveApi, recordToEditForm } from './customerEditFormState'
import { drivingText } from '../../../components/customer/CustomerForm'

export type CustomerBasicCoreFormDraft = {
  name: string
  gender: 'male' | 'female' | null
  ssn: string
  phone: string
  carrier: string
  smsOptOut: boolean
  inflowSource: string
  referrerName: string
  birthDate: string
  zonecode: string
  address: string
  addressDetail: string
  height: string
  weight: string
  job: string
  isDriver: boolean | null
  treatmentHistoryNote: string
  medicationHistoryNote: string
  insuranceHistory: string
  accountNumber: string
}

export function recordToBasicCoreDraft(customer: CustomerRecord): CustomerBasicCoreFormDraft {
  const form = recordToEditForm(customer)
  const parsed = parseAddressFromStored(customer.address ?? '')
  const notes = normalizeCustomerNotesBag(customer.notes)
  return {
    name: form.name,
    gender: form.gender,
    ssn: form.ssn,
    phone: form.phone,
    carrier: form.carrier,
    smsOptOut: form.smsOptOut,
    inflowSource: form.inflowSource,
    referrerName: form.referrerName,
    birthDate: form.birthDate,
    zonecode: parsed.zonecode,
    address: parsed.baseAddress,
    addressDetail: parsed.detailAddress,
    height: form.height,
    weight: form.weight,
    job: form.job,
    isDriver: form.isDriver,
    treatmentHistoryNote: form.treatmentHistoryNote,
    medicationHistoryNote: form.medicationHistoryNote,
    insuranceHistory: notes.insuranceHistory ?? '',
    accountNumber: notes.accountNumber ?? '',
  }
}

export function isCustomerBasicCoreDraftDirty(
  customer: CustomerRecord,
  draft: CustomerBasicCoreFormDraft,
): boolean {
  return JSON.stringify(recordToBasicCoreDraft(customer)) !== JSON.stringify(draft)
}

export function getCustomerBasicCoreValidationError(draft: CustomerBasicCoreFormDraft): string | null {
  if (!draft.name.trim()) {
    return '이름은 필수입니다.'
  }
  return null
}

export async function saveCustomerBasicCoreInfo(params: {
  token: string
  customer: CustomerRecord
  draft: CustomerBasicCoreFormDraft
}): Promise<CustomerRecord> {
  const { token, customer, draft } = params
  const validationError = getCustomerBasicCoreValidationError(draft)
  if (validationError) {
    throw new Error(validationError)
  }
  const notesBag = normalizeCustomerNotesBag(customer.notes)
  const birthDateForApi = normalizeBirthDateForSaveApi(draft.birthDate)

  return updateCustomer(token, customer.id, {
    name: draft.name.trim(),
    ssn: draft.ssn,
    phone: draft.phone,
    carrier: normalizeCustomerCarrierForSave(draft.carrier),
    ...(birthDateForApi != null ? { birthDate: birthDateForApi } : {}),
    address: formatAddressForSave({
      zonecode: draft.zonecode ?? '',
      baseAddress: draft.address ?? '',
      detailAddress: draft.addressDetail ?? '',
    }),
    height: draft.height,
    weight: draft.weight,
    job: draft.job,
    driving: drivingText(draft.isDriver),
    medical: buildLegacyMedicalColumnValue(draft.treatmentHistoryNote, draft.medicationHistoryNote),
    gender: draft.gender,
    isDriver: draft.isDriver,
    notes: {
      items: notesBag.items,
      insuranceHistory: draft.insuranceHistory.trim(),
      accountNumber: draft.accountNumber.trim(),
      treatmentHistoryNote: draft.treatmentHistoryNote.trim(),
      medicationHistoryNote: draft.medicationHistoryNote.trim(),
    },
    isFavorite: customer.isFavorite === true,
    smsOptOut: draft.smsOptOut === true,
    inflowSource: draft.inflowSource.trim() || null,
    referrerName: resolveReferrerNameForSave(draft.inflowSource, draft.referrerName),
  })
}

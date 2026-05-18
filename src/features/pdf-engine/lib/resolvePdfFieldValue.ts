import type { CustomerRecord } from '../../customers/domain/types'
import {
  isCustomerPdfFieldKey,
  labelForCustomerPdfFieldKey,
  pickCustomerPdfFieldValue,
} from '../config/customerPdfFieldOptions'
import type { PdfFieldDataMapping, PdfFieldSpec } from '../types'
import { DEFAULT_PDF_FIELD_DATA_MAPPING } from '../types'

export function normalizePdfFieldDataMapping(
  raw: Partial<PdfFieldDataMapping> | null | undefined,
): PdfFieldDataMapping {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PDF_FIELD_DATA_MAPPING }
  }
  const typeRaw = raw.dataSourceType === 'customer' ? 'customer' : 'manual'
  let customerFieldKey =
    typeof raw.customerFieldKey === 'string' ? raw.customerFieldKey.trim() : null
  if (customerFieldKey === 'dob') {
    customerFieldKey = 'birthDate'
  }
  if (customerFieldKey && !isCustomerPdfFieldKey(customerFieldKey)) {
    customerFieldKey = null
  }
  const customerFieldLabel =
    typeof raw.customerFieldLabel === 'string' && raw.customerFieldLabel.trim()
      ? raw.customerFieldLabel.trim()
      : customerFieldKey
        ? labelForCustomerPdfFieldKey(customerFieldKey)
        : null
  const fallbackText =
    typeof raw.fallbackText === 'string' ? raw.fallbackText.trim().slice(0, 500) : null
  const transformType =
    typeof raw.transformType === 'string' && raw.transformType.trim()
      ? raw.transformType.trim().slice(0, 40)
      : null

  if (typeRaw !== 'customer') {
    return {
      dataSourceType: 'manual',
      customerFieldKey: null,
      customerFieldLabel: null,
      fallbackText,
      transformType,
    }
  }
  return {
    dataSourceType: 'customer',
    customerFieldKey,
    customerFieldLabel,
    fallbackText,
    transformType,
  }
}

export function resolvePdfFieldValue(input: {
  field: Pick<PdfFieldSpec, 'dataMapping'>
  manualValue?: string | null
  customer?: CustomerRecord | null
  overwriteMode?: boolean
}): string {
  const manual = (input.manualValue ?? '').trim()
  const mapping = normalizePdfFieldDataMapping(input.field.dataMapping)

  if (mapping.dataSourceType !== 'customer' || !mapping.customerFieldKey) {
    return manual
  }

  const fromCustomer = pickCustomerPdfFieldValue(input.customer as CustomerRecord, mapping.customerFieldKey)
  const resolved = fromCustomer || mapping.fallbackText || ''

  if (input.overwriteMode) {
    return resolved
  }
  if (manual) {
    return manual
  }
  return resolved
}

export function applyCustomerDataToPdfValues(
  fields: PdfFieldSpec[],
  values: Record<string, string>,
  customer: CustomerRecord | null,
  opts?: { overwriteMode?: boolean },
): Record<string, string> {
  const overwriteMode = opts?.overwriteMode === true
  const out = { ...values }
  for (const field of fields) {
    const key = field.fieldKey
    const manual = (out[key] ?? '').trim()
    const next = resolvePdfFieldValue({
      field,
      manualValue: manual,
      customer,
      overwriteMode,
    })
    if (overwriteMode || !manual) {
      out[key] = next
    }
  }
  return out
}

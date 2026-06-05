import type { CustomerRecord } from '../../customers/domain/types'
import type { PdfFieldSpec } from '../types'

export type PdfCustomerSearchHints = {
  name: string
  phone: string
  birthDate: string
  residentRegistrationNumber: string
}

export function extractCustomerSearchHintsFromPdfForm(
  fields: PdfFieldSpec[],
  values: Record<string, string>,
): PdfCustomerSearchHints {
  const hints: PdfCustomerSearchHints = {
    name: '',
    phone: '',
    birthDate: '',
    residentRegistrationNumber: '',
  }

  for (const field of fields) {
    const mappedKey = field.dataMapping?.customerFieldKey
    if (!mappedKey) {
      continue
    }
    const raw = (values[field.fieldKey] ?? '').trim()
    if (!raw) {
      continue
    }
    if (mappedKey === 'name') {
      hints.name = raw
    } else if (mappedKey === 'phone') {
      hints.phone = raw
    } else if (mappedKey === 'birthDate') {
      hints.birthDate = raw
    } else if (mappedKey === 'residentRegistrationNumber') {
      hints.residentRegistrationNumber = raw
    }
  }

  return hints
}

export function buildApplicationCustomerSearchQuery(
  hints: PdfCustomerSearchHints,
  fallbackName?: string,
): string {
  const phoneDigits = hints.phone.replace(/\D/g, '')
  if (phoneDigits.length >= 10) {
    return phoneDigits
  }
  const name = hints.name.trim() || (fallbackName ?? '').trim()
  if (name.length >= 2) {
    return name
  }
  return ''
}

export type ApplicationCustomerAutoMatchResult =
  | { kind: 'none'; reason: 'no query' | 'no candidates' | 'user selected' | 'route customer' }
  | { kind: 'skipped'; reason: 'multiple distinct customers'; count: number }
  | { kind: 'selected'; customer: CustomerRecord }

export function resolveApplicationCustomerAutoMatch(
  rows: CustomerRecord[],
  opts?: { allowMultipleAfterDedupe?: boolean },
): ApplicationCustomerAutoMatchResult {
  if (rows.length === 0) {
    return { kind: 'none', reason: 'no candidates' }
  }
  if (rows.length === 1) {
    return { kind: 'selected', customer: rows[0] }
  }
  if (opts?.allowMultipleAfterDedupe) {
    return { kind: 'skipped', reason: 'multiple distinct customers', count: rows.length }
  }
  return { kind: 'skipped', reason: 'multiple distinct customers', count: rows.length }
}

export function logApplicationCustomerAutoMatchDebug(
  result: ApplicationCustomerAutoMatchResult,
  hints?: PdfCustomerSearchHints,
): void {
  if (!import.meta.env.DEV) {
    return
  }
  if (hints) {
    console.debug('auto match hint', {
      name: hints.name || undefined,
      phone: hints.phone ? '[redacted]' : undefined,
      birth: hints.birthDate || hints.residentRegistrationNumber ? '[set]' : undefined,
    })
  }
  if (result.kind === 'selected') {
    console.debug(`auto match selected: customerId=${result.customer.id}`)
    return
  }
  if (result.kind === 'skipped') {
    console.debug(`auto match skipped: multiple distinct customers (${result.count})`)
    return
  }
  if (result.reason === 'no candidates') {
    console.debug('auto match skipped: no candidates')
    return
  }
  if (result.reason === 'no query') {
    console.debug('auto match skipped: no hint')
  }
}

export function logManualCustomerSearchDebug(q: string, resultCount: number): void {
  if (!import.meta.env.DEV) {
    return
  }
  console.debug('manual customer search', { q, resultCount })
}

export function logManualCustomerSearchResultsRendered(): void {
  if (!import.meta.env.DEV) {
    return
  }
  console.debug('manual customer search results rendered')
}

export function logManualCustomerCandidateSelected(customerId: number): void {
  if (!import.meta.env.DEV) {
    return
  }
  console.debug(`manual customer candidate selected: customerId=${customerId}`)
}

export function logSelectedCustomerDataLoaded(customerId: number): void {
  if (!import.meta.env.DEV) {
    return
  }
  console.debug(`selected customer data loaded: customerId=${customerId}`)
}

export function logCustomerCarPickerDebug(payload: {
  appliedCustomerId: number | null
  hasCarMappedFields: boolean
  carFieldKeys: string[]
  carsCount: number
  pdfCarPickerPassed: boolean
  customerCarsFetchComplete: boolean
}): void {
  if (!import.meta.env.DEV) {
    return
  }
  console.debug('customer car picker debug', payload)
}

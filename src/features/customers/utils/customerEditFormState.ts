import type { CustomerRecord } from '../domain/types'
import { normalizeCustomerNotesBag } from '../domain/types'
import type { CustomerEditFormState } from '../components/CustomerListCard'

export function inferIsDriverFromDriving(driving: string): boolean | null {
  const t = String(driving ?? '').trim()
  if (!t) {
    return null
  }
  if (t.includes('운전 안함') || t.includes('안 함')) {
    return false
  }
  if (t.startsWith('운전함') || t === '운전') {
    return true
  }
  return null
}

export function recordToEditForm(c: CustomerRecord): CustomerEditFormState {
  let isDriver = c.isDriver
  if (isDriver == null) {
    isDriver = inferIsDriverFromDriving(c.driving)
  }
  return {
    name: c.name ?? '',
    gender: c.gender ?? null,
    ssn: c.ssn ?? '',
    phone: c.phone ?? '',
    address: c.address ?? '',
    addressDetail: '',
    zonecode: '',
    height: c.height ?? '',
    weight: c.weight ?? '',
    job: c.job ?? '',
    isDriver,
    carType: c.carType ?? '',
    medical: c.medical ?? '',
    insuranceHistory: normalizeCustomerNotesBag(c.notes).insuranceHistory,
    carNumber: c.carNumber ?? '',
    carModel: c.carModel ?? '',
    carYear: c.carYear ?? '',
    renewalDate: c.renewalDate ?? '',
  }
}

export function normalizeCustomerEditCarYearForApi(raw: string | undefined): string {
  return String(raw ?? '').replace(/\D/g, '')
}

export function normalizeCustomerEditRenewalDateForApi(raw: string | undefined): string {
  const s = String(raw ?? '').trim()
  if (!s) {
    return ''
  }
  const head = s.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : ''
}

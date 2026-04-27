import type { CustomerImportRowStatus } from '../types/customerImportTypes'

export const customerImportRowStatusLabel: Record<CustomerImportRowStatus, string> = {
  ready: '정상',
  incomplete: '미완료',
  duplicate: '중복',
  error: '오류',
  imported: '반영 완료',
}

export function labelForImportStatus(status: string): string {
  if (status in customerImportRowStatusLabel) {
    return customerImportRowStatusLabel[status as CustomerImportRowStatus]
  }
  return status
}

export type CustomerImportRowStatus = 'ready' | 'incomplete' | 'duplicate' | 'error' | 'imported'

export type CustomerImportJobStatus = string

export type CustomerImportNormalizedRow = {
  name?: string
  phone?: string
  ssn?: string
  ssnDigits?: string
  gender?: string
  address?: string
  carNumber?: string
  renewalDate?: string
  job?: string
  notesText?: string
}

export type CustomerImportJob = {
  id: string
  userId: string
  gaId: number
  originalFilename: string
  status: CustomerImportJobStatus
  totalRows: number
  readyRows: number
  incompleteRows: number
  duplicateRows: number
  errorRows: number
  importedRows: number
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export type CustomerImportRowRecord = {
  id: string
  jobId: string
  rowIndex: number
  rawRow: Record<string, unknown>
  normalizedRow: CustomerImportNormalizedRow | null
  status: CustomerImportRowStatus
  reason: string | null
  matchedCustomerId: number | null
  createdAt: string
  updatedAt: string
}

export interface InsuranceCompanyFormState {
  id: number | null
  category: string
  name: string
  customerCenter: string
  systemPhone: string
  incallNumber: string
  visitInfo: string
}

export interface InsuranceCompanyContactDraft {
  name: string
  position: string
  phone: string
}

export interface InsuranceGeneralDraft {
  description: string
  phone: string
  fax: string
  email: string
}

export interface CompanyDirectoryEntry {
  id: number
  category: string
  name: string
  customerCenter: string
  systemPhone: string
  incallNumber: string
  visitInfo: string
  createdAt?: string
  contacts: Array<
    InsuranceCompanyContactDraft & {
      id: number
      companyId: number
    }
  >
  general: (InsuranceGeneralDraft & { id: number; companyId: number }) | null
}

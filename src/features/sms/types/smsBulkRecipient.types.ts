export type SmsBulkGenderFilter = '' | 'all' | 'male' | 'female'

export type SmsBulkRecipientFilters = {
  search: string
  gender: SmsBulkGenderFilter
  sangnyeongDays: string
  insuranceAgeFrom: string
  insuranceAgeTo: string
}

export const EMPTY_SMS_BULK_FILTERS: SmsBulkRecipientFilters = {
  search: '',
  gender: 'all',
  sangnyeongDays: '',
  insuranceAgeFrom: '',
  insuranceAgeTo: '',
}

export type SmsBulkSearchCustomer = {
  customerId: number
  name: string
  gender: 'male' | 'female' | null
  genderLabel: string
  birthDate: string | null
  phone: string | null
  phoneDisplay: string
  insuranceAge: number | null
  sangnyeongDday: number | null
  sangnyeongLabel: string
  canSend: boolean
  blockedReason: string | null
}

export type SmsSelectedRecipient = SmsBulkSearchCustomer

export type SmsRecipientGroupSummary = {
  id: number
  name: string
  description: string
  recipientCount: number
  lastSentAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type SmsRecipientAddResult = {
  addedCount: number
  skipped: {
    already_added: number
    duplicate_phone: number
    no_phone: number
    invalid_phone: number
    opt_out: number
  }
}

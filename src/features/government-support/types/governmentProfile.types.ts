export type GovSupportProfile = {
  id: string
  tenantId: string
  customerName: string
  phone: string
  carrier: string
  ssn: string
  homeAddress: string
  homeType: string
  deposit: string
  monthlyRent: string
  creditScore1: string
  creditScore2: string
  businessName: string
  businessOpenedAt: string
  businessNumber: string
  businessAddress: string
  businessCategory: string
  businessType: string
  businessForm: string
  businessPhone: string
  productName: string
  availableProduct: string
  progressStatus: string
  scheduleAt: string
  agencyOrg: string
  assigneeUserId: string | null
  region: string
  note: string
  specialNote: string
  vatReport: string
  annualIncome: string
  incomeCert: string
  taxArrears: string
  requiredFunds: string
  fee: string
  certDelegate: string
  certType: string
  delegateStatus: string
  delegationMemo: string
  edocStatus: string
  docStatus: string
}

export type GovAgencyRow = {
  id: string
  agencyCode: string
  name: string
  status: string
}

export type GovPriorLoan = {
  id: string
  profileId: string
  hasPrior: string
  lenderName: string
  remainingAmount: string
  receivedAt: string
  policyIncluded: string
  memo: string
}

export type GovApplicationCase = {
  id: string
  profileId: string
  productName: string
  availableProduct: string
  progressStatus: string
  scheduleAt: string
  agencyOrg: string
  requiredFunds: string
  fee: string
  certDelegate: string
  specialNote: string
}

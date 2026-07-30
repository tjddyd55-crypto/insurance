import { apiRequest } from '../../../lib/apiClient'

export type PaymentCardRow = {
  id: number
  customerId: number
  label: string
  cardOwnerName: string
  cardNumber: string | null
  cardNumberDisplay: string | null
  cardNumberLast4: string
  cardExpiryMonth: number
  cardExpiryYear: number
  cardExpiry: string
  isDefault: boolean
}

export type CardPaymentContractRow = {
  id: number
  customerId: number
  customerName?: string
  customerPhone?: string
  ownerDisplayName?: string
  paymentCardId: number | null
  insuranceCompany: string
  policyNumber: string | null
  productName: string | null
  premiumAmount: number | null
  paymentDay: number | null
  memo: string
  status: 'PENDING' | 'PAUSED'
  monthStatus: 'PENDING' | 'COMPLETED' | 'PAUSED'
  targetMonth: string
  lastCompletedAt: string | null
  monthCompletedAt: string | null
  card: {
    id: number
    label: string
    cardOwnerName: string
    cardNumberLast4: string
    cardNumber: string | null
    cardNumberDisplay: string | null
    cardExpiry: string
    cardExpiryMonth: number
    cardExpiryYear: number
  } | null
}

export type PaymentCardWritePayload = {
  label?: string
  cardOwnerName: string
  cardNumber?: string
  cardExpiryMonth: number
  cardExpiryYear: number
}

export type ContractWritePayload = {
  insuranceCompany: string
  policyNumber?: string | null
  productName?: string | null
  premiumAmount?: number | null
  paymentDay?: number | null
  paymentCardId?: number | null
  memo?: string
  status?: 'PENDING' | 'PAUSED'
}

export type OverviewSummary = {
  total: number
  pending: number
  completed: number
  paused: number
}

export function formatCardExpiry(month: number, year: number): string {
  return `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`
}

export function formatPremiumAmount(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) {
    return '-'
  }
  return `${amount.toLocaleString('ko-KR')}원`
}

export function formatPaymentDay(day: number | null | undefined): string {
  if (day == null) {
    return '결제일 미입력'
  }
  return `매월 ${day}일`
}

export function monthStatusLabel(status: CardPaymentContractRow['monthStatus']): string {
  if (status === 'COMPLETED') {
    return '이번 달 완료'
  }
  if (status === 'PAUSED') {
    return '보류'
  }
  return '처리 필요'
}

export function formatLastCompletedAt(iso: string | null | undefined): string {
  if (!iso) {
    return '-'
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return '-'
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

export async function listPaymentCards(token: string, customerId: number): Promise<PaymentCardRow[]> {
  const data = await apiRequest<{ cards: PaymentCardRow[] }>(
    `/api/customers/${customerId}/payment-cards`,
    { token },
  )
  return data.cards ?? []
}

export async function createPaymentCard(
  token: string,
  customerId: number,
  payload: PaymentCardWritePayload,
): Promise<PaymentCardRow> {
  return apiRequest<PaymentCardRow>(`/api/customers/${customerId}/payment-cards`, {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export async function updatePaymentCard(
  token: string,
  customerId: number,
  cardId: number,
  payload: PaymentCardWritePayload,
): Promise<PaymentCardRow> {
  return apiRequest<PaymentCardRow>(`/api/customers/${customerId}/payment-cards/${cardId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(payload),
  })
}

export async function deletePaymentCard(
  token: string,
  customerId: number,
  cardId: number,
): Promise<void> {
  await apiRequest(`/api/customers/${customerId}/payment-cards/${cardId}`, {
    method: 'DELETE',
    token,
  })
}

export async function listCardPaymentContracts(
  token: string,
  customerId: number,
  month?: string,
): Promise<{ targetMonth: string; contracts: CardPaymentContractRow[] }> {
  const q = month ? `?month=${encodeURIComponent(month)}` : ''
  return apiRequest(`/api/customers/${customerId}/card-payment-contracts${q}`, { token })
}

export async function createCardPaymentContract(
  token: string,
  customerId: number,
  payload: ContractWritePayload,
): Promise<CardPaymentContractRow> {
  return apiRequest(`/api/customers/${customerId}/card-payment-contracts`, {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export async function updateCardPaymentContract(
  token: string,
  customerId: number,
  contractId: number,
  payload: ContractWritePayload,
): Promise<CardPaymentContractRow> {
  return apiRequest(`/api/customers/${customerId}/card-payment-contracts/${contractId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(payload),
  })
}

export async function deleteCardPaymentContract(
  token: string,
  customerId: number,
  contractId: number,
): Promise<void> {
  await apiRequest(`/api/customers/${customerId}/card-payment-contracts/${contractId}`, {
    method: 'DELETE',
    token,
  })
}

export async function completeCardPaymentContract(
  token: string,
  customerId: number,
  contractId: number,
  targetMonth: string,
): Promise<{ targetMonth: string; contract: CardPaymentContractRow }> {
  return apiRequest(`/api/customers/${customerId}/card-payment-contracts/${contractId}/complete`, {
    method: 'POST',
    token,
    body: JSON.stringify({ targetMonth }),
  })
}

export async function reopenCardPaymentContract(
  token: string,
  customerId: number,
  contractId: number,
  targetMonth: string,
): Promise<{ targetMonth: string; contract: CardPaymentContractRow }> {
  return apiRequest(`/api/customers/${customerId}/card-payment-contracts/${contractId}/reopen`, {
    method: 'POST',
    token,
    body: JSON.stringify({ targetMonth, setPending: true }),
  })
}

export async function listCardPaymentContractsOverview(
  token: string,
  opts: {
    month?: string
    status?: string
    search?: string
    insuranceCompany?: string
    paymentDay?: string
    ownerUserId?: string
  } = {},
): Promise<{
  targetMonth: string
  summary: OverviewSummary
  contracts: CardPaymentContractRow[]
}> {
  const params = new URLSearchParams()
  if (opts.month) params.set('month', opts.month)
  if (opts.status) params.set('status', opts.status)
  if (opts.search) params.set('search', opts.search)
  if (opts.insuranceCompany) params.set('insuranceCompany', opts.insuranceCompany)
  if (opts.paymentDay) params.set('paymentDay', opts.paymentDay)
  if (opts.ownerUserId) params.set('ownerUserId', opts.ownerUserId)
  const q = params.toString()
  return apiRequest(`/api/card-payment-contracts${q ? `?${q}` : ''}`, { token })
}

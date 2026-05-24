export type PaymentMode = 'virtual' | 'live'

export const PAYMENT_MODE_OPTIONS = [
  { value: 'virtual', label: '가상 결제' },
  { value: 'live', label: '실결제 준비중' },
] as const satisfies ReadonlyArray<{ value: PaymentMode; label: string }>

export const PAYMENT_PROVIDER_OPTIONS = [
  { value: 'toss', label: 'Toss Payments' },
  { value: 'none', label: '미설정' },
] as const

export function normalizePaymentMode(value: unknown): PaymentMode {
  const mode = String(value ?? '').trim().toLowerCase()
  return mode === 'live' ? 'live' : 'virtual'
}

export function normalizePaymentProvider(value: unknown): string {
  const provider = String(value ?? '').trim().toLowerCase()
  if (provider === 'none') return 'none'
  return 'toss'
}

export function paymentModeLabel(mode: PaymentMode): string {
  return PAYMENT_MODE_OPTIONS.find((row) => row.value === mode)?.label ?? '가상 결제'
}

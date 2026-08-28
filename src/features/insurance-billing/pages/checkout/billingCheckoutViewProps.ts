import type { BillingCheckoutConfig, CheckoutQuote, CheckoutSummary } from '../api/insuranceBillingApi'
import type { BillingCheckoutMode } from '../billingCheckoutViewState'

export type BillingCheckoutViewProps = {
  loading: boolean
  summaryLoadError: string | null
  error: string
  summary: CheckoutSummary | null
  checkoutMode: BillingCheckoutMode
  billingCycle: 'monthly' | 'yearly'
  onSelectCycle: (cycle: 'monthly' | 'yearly') => void
  promoAllowed: boolean
  promoCode: string
  onPromoCodeChange: (value: string) => void
  onApplyPromo: () => void
  onClearPromo: () => void
  promoMessage: string
  quote: CheckoutQuote | null
  quoteLoading: boolean
  checkoutConfig: BillingCheckoutConfig | null | undefined
  hasBillingKey: boolean
  canUseToss: boolean
  isActiveEntitled: boolean
  submitting: boolean
  ctaLabel: string
  ctaDisabled: boolean
  onRegisterCard: () => void
  onPrimaryAction: () => void
  onGoManage: () => void
  onGoCrm: () => void
  canRunTestCharge: boolean
  qaTestCode: string
  onQaTestCodeChange: (value: string) => void
  onTestCharge: () => void
  variant: 'pc' | 'mobile'
}

import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useBillingCheckoutState } from '../hooks/useBillingCheckoutState'
import type { BillingCheckoutViewProps } from './checkout/billingCheckoutViewProps'
import BillingCheckoutPCView from './checkout/BillingCheckoutPCView'
import BillingCheckoutMobileView from './checkout/BillingCheckoutMobileView'
import '../insurance-billing.css'

export default function BillingCheckoutPage() {
  const state = useBillingCheckoutState()
  const viewProps: BillingCheckoutViewProps = {
    ...state,
    variant: 'pc',
  }
  const mobileProps: BillingCheckoutViewProps = {
    ...state,
    variant: 'mobile',
  }

  return (
    <ResponsiveLayout<BillingCheckoutViewProps>
      PC={BillingCheckoutPCView}
      Mobile={BillingCheckoutMobileView}
      pcViewProps={viewProps}
      mobileViewProps={mobileProps}
    />
  )
}

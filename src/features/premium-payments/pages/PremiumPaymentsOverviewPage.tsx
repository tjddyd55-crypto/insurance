import { useNavigate } from 'react-router-dom'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useAuth } from '../../auth/AuthProvider'
import { usePremiumPaymentsOverviewState } from '../hooks/usePremiumPaymentsOverviewState'
import PremiumPaymentsOverviewPCView from './overview/PremiumPaymentsOverviewPCView'
import PremiumPaymentsOverviewMobileView from './overview/PremiumPaymentsOverviewMobileView'
import type { PremiumPaymentsOverviewViewProps } from './overview/premiumPaymentsOverviewViewProps'

export default function PremiumPaymentsOverviewPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const state = usePremiumPaymentsOverviewState(token)

  const viewProps: PremiumPaymentsOverviewViewProps = {
    state,
    onOpenCustomer: (customerId) => {
      if (!customerId) {
        return
      }
      navigate(`/customers/${customerId}/premium-payments`)
    },
  }

  return (
    <ResponsiveLayout<PremiumPaymentsOverviewViewProps>
      PC={PremiumPaymentsOverviewPCView}
      Mobile={PremiumPaymentsOverviewMobileView}
      viewProps={viewProps}
    />
  )
}

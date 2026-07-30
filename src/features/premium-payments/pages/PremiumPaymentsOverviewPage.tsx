import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useConfirmDialog } from '../../../components/dialog'
import { useAuth } from '../../auth/AuthProvider'
import { useNavigate } from 'react-router-dom'
import { usePremiumPaymentsOverviewState } from '../hooks/usePremiumPaymentsOverviewState'
import PremiumPaymentsOverviewPCView from './overview/PremiumPaymentsOverviewPCView'
import PremiumPaymentsOverviewMobileView from './overview/PremiumPaymentsOverviewMobileView'
import type { PremiumPaymentsOverviewViewProps } from './overview/premiumPaymentsOverviewViewProps'
import '../premium-payments.css'

export default function PremiumPaymentsOverviewPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const { confirm, confirmDialog } = useConfirmDialog()
  const state = usePremiumPaymentsOverviewState(token)

  const viewProps: PremiumPaymentsOverviewViewProps = {
    ...state,
    onOpenCustomer: (customerId) => {
      navigate(`/customers/${customerId}/premium-payments`)
    },
    onConfirmDeleteContract: async (row) => {
      const ok = await confirm({
        title: '수납 대상을 삭제할까요?',
        message: `${row.insuranceCompany} 카드 수납 대상이 삭제됩니다.`,
        confirmLabel: '삭제',
        tone: 'danger',
      })
      if (!ok) return
      await state.removeContract(row)
    },
  }

  return (
    <>
      <ResponsiveLayout<PremiumPaymentsOverviewViewProps>
        PC={PremiumPaymentsOverviewPCView}
        Mobile={PremiumPaymentsOverviewMobileView}
        viewProps={viewProps}
      />
      {confirmDialog}
    </>
  )
}

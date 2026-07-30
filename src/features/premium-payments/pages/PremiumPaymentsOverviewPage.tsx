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
    onConfirmComplete: async (row) => {
      const ok = await confirm({
        title: '카드 수납을 완료 처리할까요?',
        message: `${row.customerName ?? '고객'} 고객의 ${row.insuranceCompany} 카드 수납 건을 완료로 기록합니다.`,
        confirmLabel: '처리 완료',
      })
      if (!ok) return
      await state.markComplete(row)
    },
    onConfirmReopen: async (row) => {
      const ok = await confirm({
        title: '처리 필요로 변경',
        message: `${row.insuranceCompany} 건을 처리 필요로 되돌릴까요?`,
        confirmLabel: '변경',
      })
      if (!ok) return
      await state.markReopen(row)
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

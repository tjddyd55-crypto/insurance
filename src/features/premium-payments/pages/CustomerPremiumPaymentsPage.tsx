import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useConfirmDialog } from '../../../components/dialog'
import { useAuth } from '../../auth/AuthProvider'
import { useParams } from 'react-router-dom'
import { useCustomerPremiumPaymentsState } from '../hooks/useCustomerPremiumPaymentsState'
import CustomerPremiumPaymentsPCView from './customer/CustomerPremiumPaymentsPCView'
import CustomerPremiumPaymentsMobileView from './customer/CustomerPremiumPaymentsMobileView'
import type { CustomerPremiumPaymentsViewProps } from './customer/customerPremiumPaymentsViewProps'

export default function CustomerPremiumPaymentsPage() {
  const { customerId: rawId } = useParams()
  const customerId = Number(rawId)
  const { token } = useAuth()
  const { confirm, confirmDialog } = useConfirmDialog()
  const state = useCustomerPremiumPaymentsState(customerId, token)

  const viewProps: CustomerPremiumPaymentsViewProps = {
    customerId,
    state,
    onConfirmDisable: async (rowId) => {
      const row = state.rows.find((r) => r.id === rowId)
      if (!row) {
        return
      }
      const ok = await confirm({
        title: '결제 정보 사용 중지',
        message: '이 카드 정보를 사용 중지할까요? 나중에 다시 사용할 수 있습니다.',
        confirmLabel: '사용 중지',
        tone: 'danger',
      })
      if (!ok) {
        return
      }
      await state.toggleActive(row, false)
    },
    onConfirmEnable: async (rowId) => {
      const row = state.rows.find((r) => r.id === rowId)
      if (!row) {
        return
      }
      const ok = await confirm({
        title: '결제 정보 다시 사용',
        message: '이 카드 정보를 다시 사용할까요?',
        confirmLabel: '다시 사용',
      })
      if (!ok) {
        return
      }
      await state.toggleActive(row, true)
    },
  }

  return (
    <>
      <ResponsiveLayout<CustomerPremiumPaymentsViewProps>
        PC={CustomerPremiumPaymentsPCView}
        Mobile={CustomerPremiumPaymentsMobileView}
        viewProps={viewProps}
      />
      {confirmDialog}
    </>
  )
}

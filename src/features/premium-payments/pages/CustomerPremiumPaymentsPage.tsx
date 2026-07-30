import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useConfirmDialog } from '../../../components/dialog'
import { useAuth } from '../../auth/AuthProvider'
import { useParams } from 'react-router-dom'
import { useCustomerPremiumPaymentsState } from '../hooks/useCustomerPremiumPaymentsState'
import CustomerPremiumPaymentsPCView from './customer/CustomerPremiumPaymentsPCView'
import CustomerPremiumPaymentsMobileView from './customer/CustomerPremiumPaymentsMobileView'
import type { CustomerPremiumPaymentsViewProps } from './customer/customerPremiumPaymentsViewProps'
import '../premium-payments.css'

export default function CustomerPremiumPaymentsPage() {
  const { customerId: rawId } = useParams()
  const customerId = Number(rawId)
  const { token } = useAuth()
  const { confirm, confirmDialog } = useConfirmDialog()
  const state = useCustomerPremiumPaymentsState(customerId, token)

  const viewProps: CustomerPremiumPaymentsViewProps = {
    customerId,
    customerName: '',
    state,
    onConfirmDeleteCard: async (cardId) => {
      const card = state.cards.find((item) => item.id === cardId)
      if (!card) return
      const ok = await confirm({
        title: '카드정보를 삭제할까요?',
        message: '등록된 카드정보가 삭제됩니다.',
        confirmLabel: '삭제',
        tone: 'danger',
      })
      if (!ok) return
      await state.removeCard(card)
    },
    onConfirmDeleteContract: async (contractId) => {
      const row = state.contracts.find((item) => item.id === contractId)
      if (!row) return
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
      <ResponsiveLayout<CustomerPremiumPaymentsViewProps>
        PC={CustomerPremiumPaymentsPCView}
        Mobile={CustomerPremiumPaymentsMobileView}
        viewProps={viewProps}
      />
      {confirmDialog}
    </>
  )
}

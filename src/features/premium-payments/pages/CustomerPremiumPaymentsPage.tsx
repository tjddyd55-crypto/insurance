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
        title: '카드정보 삭제',
        message: '이 카드정보를 삭제할까요? 연결된 수납 대상의 카드 연결은 해제됩니다.',
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
        title: '수납 대상 삭제',
        message: `${row.insuranceCompany} 수납 대상을 삭제할까요?`,
        confirmLabel: '삭제',
        tone: 'danger',
      })
      if (!ok) return
      await state.removeContract(row)
    },
    onConfirmComplete: async (contractId) => {
      const row = state.contracts.find((item) => item.id === contractId)
      if (!row) return
      const ok = await confirm({
        title: '카드 수납을 완료 처리할까요?',
        message: `고객의 ${row.insuranceCompany} 카드 수납 건을 완료로 기록합니다.`,
        confirmLabel: '처리 완료',
      })
      if (!ok) return
      await state.markComplete(row)
    },
    onConfirmReopen: async (contractId) => {
      const row = state.contracts.find((item) => item.id === contractId)
      if (!row) return
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
      <ResponsiveLayout<CustomerPremiumPaymentsViewProps>
        PC={CustomerPremiumPaymentsPCView}
        Mobile={CustomerPremiumPaymentsMobileView}
        viewProps={viewProps}
      />
      {confirmDialog}
    </>
  )
}

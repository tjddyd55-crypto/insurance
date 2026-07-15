import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import ContractSignatureHistoryPage from '../../contracts/userHistory/ContractSignatureHistoryPage'
import ContractSignatureSendPage from '../../contracts/userSend/ContractSignatureSendPage'
import { canShowCustomerDetailElectronicSignature } from '../config/customerDetailFeatureFlags'
import { parseSelectedCustomerId } from '../utils/customerWorkspaceNavigation'

/**
 * 고객 작업영역 전자서명 탭 — 선택 고객 기준 발송 + 발송 내역.
 * 전역 `/contracts/signatures/send` 와 분리된 customer-scoped route.
 * `CUSTOMER_DETAIL_FEATURE_FLAGS.electronicSignature` 가 꺼져 있으면 고객 파일 탭으로 보낸다.
 */
export default function CustomerSignaturesRoutePage() {
  const { user } = useAuth()
  const { customerId: rawCustomerId } = useParams<{ customerId: string }>()
  const customerId = parseSelectedCustomerId(rawCustomerId ?? null)

  if (customerId == null) {
    return null
  }

  if (!canShowCustomerDetailElectronicSignature(user?.role)) {
    return <Navigate to={`/customers/${customerId}/files`} replace />
  }

  return (
    <div className="customer-signature-workspace-route">
      <ContractSignatureSendPage workspaceCustomerId={customerId} embeddedInCustomerWorkspace />
      <ContractSignatureHistoryPage workspaceCustomerId={customerId} hideSendNavigation />
    </div>
  )
}

import { useParams } from 'react-router-dom'
import ContractSignatureHistoryPage from '../../contracts/userHistory/ContractSignatureHistoryPage'
import ContractSignatureSendPage from '../../contracts/userSend/ContractSignatureSendPage'
import { parseSelectedCustomerId } from '../utils/customerWorkspaceNavigation'

/**
 * 고객 작업영역 전자서명 탭 — 선택 고객 기준 발송 + 발송 내역.
 * 전역 `/contracts/signatures/send` 와 분리된 customer-scoped route.
 */
export default function CustomerSignaturesRoutePage() {
  const { customerId: rawCustomerId } = useParams<{ customerId: string }>()
  const customerId = parseSelectedCustomerId(rawCustomerId ?? null)

  if (customerId == null) {
    return null
  }

  return (
    <div className="customer-signature-workspace-route">
      <ContractSignatureSendPage workspaceCustomerId={customerId} embeddedInCustomerWorkspace />
      <ContractSignatureHistoryPage workspaceCustomerId={customerId} hideSendNavigation />
    </div>
  )
}

import { Outlet, useNavigate } from 'react-router-dom'
import { FormButton } from '../../../../components/form'
import type { CustomerWorkspaceLayoutPCProps } from './CustomerWorkspaceLayoutPC'

function mobileWorkspaceTitle(activeTab: CustomerWorkspaceLayoutPCProps['activeTab']): string {
  if (activeTab === 'personal-message') return '개인메시지'
  if (activeTab === 'claims') return '청구 관리'
  return '고객 작업'
}

export default function CustomerWorkspaceLayoutMobile({
  selectedCustomerId,
  selectedCustomerLabel,
  activeTab,
}: CustomerWorkspaceLayoutPCProps) {
  const navigate = useNavigate()
  const shouldRenderRouteModal = activeTab === 'claims' || activeTab === 'personal-message'

  if (!selectedCustomerId || !shouldRenderRouteModal) {
    return null
  }

  const handleClose = () => {
    navigate(`/customers?customerId=${selectedCustomerId}`, { replace: true })
  }

  return (
    <section className="customer-workspace-mobile-modal" aria-label={mobileWorkspaceTitle(activeTab)}>
      <div className="customer-workspace-mobile-modal__backdrop" onClick={handleClose} />
      <div className="customer-workspace-mobile-modal__sheet">
        <header className="customer-workspace-mobile-modal__header">
          <div className="customer-workspace-mobile-modal__title-wrap">
            <div className="customer-workspace-mobile-modal__eyebrow">{selectedCustomerLabel || `고객 #${selectedCustomerId}`}</div>
            <h2 className="customer-workspace-mobile-modal__title">{mobileWorkspaceTitle(activeTab)}</h2>
          </div>
          <FormButton htmlType="button" variant="secondary" className="customer-workspace-mobile-modal__close" onClick={handleClose}>
            닫기
          </FormButton>
        </header>
        <div className="customer-workspace-mobile-modal__body">
          <Outlet key={`${selectedCustomerId}-${activeTab}`} context={{ selectedCustomerId }} />
        </div>
      </div>
    </section>
  )
}

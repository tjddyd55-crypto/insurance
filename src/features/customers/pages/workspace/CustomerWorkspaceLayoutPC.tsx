import { Outlet } from 'react-router-dom'
import { EmptyState } from '../../../../components/feedback'
import { FormButton } from '../../../../components/form'
import { ApplicationFormPage } from '../../../application/pages/ApplicationFormPage'

type WorkspaceActiveTab = 'files' | 'consultations' | 'auto' | 'ga-excel' | 'memos' | null

type CustomerWorkspaceLayoutPCProps = {
  pathname: string
  selectedCustomerId: number | null
  selectedCustomerLabel: string
  rightPanelCarForm: boolean
  activeTab: WorkspaceActiveTab
  showCarInsuranceInWorkspace: boolean
  showGaExcelEntry: boolean
  gaExcelEnabledForDesigner: boolean
  gaExcelDisabledReason: string | undefined
  onClickFiles: () => void
  onClickConsultations: () => void
  onClickCarForm: () => void
  onClickGaExcel: () => void
  onClickMemos: () => void
}

function rightTitle(pathname: string): string {
  if (pathname.includes('/files')) {
    return '고객 파일 작업'
  }
  if (pathname.includes('/consultations')) {
    return '고객 상담 작업'
  }
  if (pathname.includes('/ga-excel')) {
    return 'GA 고객 데이터'
  }
  if (pathname.includes('/memos')) {
    return '고객 메모'
  }
  return '작업 영역'
}

export default function CustomerWorkspaceLayoutPC({
  pathname,
  selectedCustomerId,
  selectedCustomerLabel,
  rightPanelCarForm,
  activeTab,
  showCarInsuranceInWorkspace,
  showGaExcelEntry,
  gaExcelEnabledForDesigner,
  gaExcelDisabledReason,
  onClickFiles,
  onClickConsultations,
  onClickCarForm,
  onClickGaExcel,
  onClickMemos,
}: CustomerWorkspaceLayoutPCProps) {
  return (
    <section className="customer-workspace-layout__right" aria-label="고객 연동 작업영역">
      <header className="customer-workspace-layout__right-header">
        <div>
          <h2 className="customer-workspace-layout__title">
            {rightPanelCarForm ? '자동차 신청서' : rightTitle(pathname)}
          </h2>
          <p className="customer-workspace-layout__subtitle">
            선택 고객: {selectedCustomerId ? selectedCustomerLabel || `고객 #${selectedCustomerId}` : '미선택'}
          </p>
        </div>
        <div className="customer-workspace-layout__actions">
          <FormButton
            htmlType="button"
            variant="action"
            className={`filter-button${activeTab === 'files' ? ' filter-button--workspace-active' : ''}`}
            disabled={!selectedCustomerId}
            onClick={onClickFiles}
          >
            고객 파일
          </FormButton>
          <FormButton
            htmlType="button"
            variant="action"
            className={`filter-button${activeTab === 'consultations' ? ' filter-button--workspace-active' : ''}`}
            disabled={!selectedCustomerId}
            onClick={onClickConsultations}
          >
            상담 이력
          </FormButton>
          {showCarInsuranceInWorkspace ? (
            <FormButton
              htmlType="button"
              variant="action"
              className={`filter-button${rightPanelCarForm ? ' filter-button--workspace-active' : ''}`}
              disabled={!selectedCustomerId}
              onClick={onClickCarForm}
            >
              자동차 신청서
            </FormButton>
          ) : null}
          {showGaExcelEntry ? (
            <FormButton
              htmlType="button"
              variant="action"
              className={`filter-button${activeTab === 'ga-excel' ? ' filter-button--workspace-active' : ''}`}
              disabled={!selectedCustomerId || !gaExcelEnabledForDesigner}
              title={gaExcelEnabledForDesigner ? undefined : gaExcelDisabledReason}
              onClick={onClickGaExcel}
            >
              GA 고객 데이터 보기
            </FormButton>
          ) : null}
          <FormButton
            htmlType="button"
            variant="action"
            className={`filter-button${activeTab === 'memos' ? ' filter-button--workspace-active' : ''}`}
            disabled={!selectedCustomerId}
            onClick={onClickMemos}
          >
            메모 보기
          </FormButton>
        </div>
      </header>

      <div className="customer-workspace-layout__right-body">
        {rightPanelCarForm && selectedCustomerId ? (
          <div
            className="customer-workspace-layout__embedded-car"
            role="region"
            aria-label="자동차 신청서 작성"
          >
            <div className="customer-workspace-layout__embedded-car-body">
              <ApplicationFormPage />
            </div>
          </div>
        ) : selectedCustomerId ? (
          <Outlet context={{ selectedCustomerId }} />
        ) : (
          <EmptyState message="고객을 선택해 주세요." />
        )}
      </div>
    </section>
  )
}

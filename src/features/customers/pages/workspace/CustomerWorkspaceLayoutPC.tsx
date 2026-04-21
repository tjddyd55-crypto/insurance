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
          /**
           * 고객 id를 자식 서브트리 key로 강제 설정.
           *
           * 이유:
           *   `CustomerFilesPage → CustomerFilesPagePC → StorageWorkspace` 처럼
           *   자식 트리 중간 어느 한 컴포넌트라도 `customerId` prop/params 변화에
           *   반응(useEffect deps)에서 누락되면 전체가 stale 된다.
           *   key 로 "고객 id = 리소스 identity" 를 선언해 고객 전환 시
           *   자식 트리를 통째로 재마운트하여 stale state 를 원천 차단한다.
           *   (같은 고객 안 탭 전환은 element 타입 변경으로 자연 교체되므로 영향 없음.)
           *
           * 근본 수정은 `CustomersPage` 모놀리식 분해(`ui-architecture.mdc` A-1)이며,
           * 본 key 가드는 분해 전까지의 방어 레이어이다.
           */
          <Outlet key={selectedCustomerId} context={{ selectedCustomerId }} />
        ) : (
          <EmptyState message="고객을 선택해 주세요." />
        )}
      </div>
    </section>
  )
}

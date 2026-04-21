import { Outlet } from 'react-router-dom'
import { EmptyState } from '../../../../components/feedback'
import { FormButton } from '../../../../components/form'

type WorkspaceActiveTab = 'files' | 'consultations' | 'auto' | 'ga-excel' | 'memos' | null

export type CustomerWorkspaceLayoutPCProps = {
  pathname: string
  selectedCustomerId: number | null
  selectedCustomerLabel: string
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

/**
 * 우측 패널 제목은 현재 URL path 로부터 1:1 로 파생된다(단일 진실 원천).
 * 제목 케이스를 추가하고 싶다면 경로 규약(`/:customerId/:tab`)을 먼저 정의하고
 * 이 함수와 `resolveWorkspacePathTab` 두 곳만 함께 업데이트하면 된다.
 */
function rightTitle(pathname: string): string {
  if (pathname.includes('/auto-form')) {
    return '자동차 신청서'
  }
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

/**
 * 우측 패널은 전적으로 URL path 를 기준으로 렌더된다.
 *
 * 이전에는 `rightPanelCarForm` 로컬 state 가 존재해 우측 body 가 두 갈래로 갈렸고
 * (자동차 폼 vs. Outlet), URL 과 로컬 state 가 drift 되며 "메뉴는 눌리는데 페이지는
 * 전환 안 됨" 같은 회귀를 반복했다. 이제 우측 body 는 한 갈래(Outlet) 만 존재하며,
 * 자동차 신청서도 `/customers/:id/auto-form` 라우트로 자연스럽게 올라온다.
 */
export default function CustomerWorkspaceLayoutPC({
  pathname,
  selectedCustomerId,
  selectedCustomerLabel,
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
          <h2 className="customer-workspace-layout__title">{rightTitle(pathname)}</h2>
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
              className={`filter-button${activeTab === 'auto' ? ' filter-button--workspace-active' : ''}`}
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
        {selectedCustomerId ? (
          /**
           * 고객 id 를 자식 서브트리 `key` 로 선언(routing-ssot.mdc 7).
           * 다중 래퍼 아래에서 `useEffect` deps 누락이 있어도 "전 고객 데이터 잔존" 회귀를
           * 막기 위한 방어 레이어. 같은 고객 내부의 탭 전환은 key 값이 동일하므로 자연 교체된다.
           */
          <Outlet key={selectedCustomerId} context={{ selectedCustomerId }} />
        ) : (
          <EmptyState message="고객을 선택해 주세요." />
        )}
      </div>
    </section>
  )
}

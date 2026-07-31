import type { MutableRefObject } from 'react'
import { Outlet } from 'react-router-dom'
import { EmptyState } from '../../../../components/feedback'
import { FormButton } from '../../../../components/form'
import type { CustomerRecord } from '../../domain/types'
import CustomerHeaderAppLinkCompact from './CustomerHeaderAppLinkCompact'
import './CustomerWorkspaceLayoutPC.css'

type WorkspaceActiveTab =
  | 'map'
  | 'files'
  | 'consultations'
  | 'premium-payments'
  | 'auto'
  | 'pdf-documents'
  | 'ga-excel'
  | 'memos'
  | 'claims'
  | 'personal-message'
  | 'signatures'
  | null

export type CustomerWorkspaceLayoutPCProps = {
  pathname: string
  selectedCustomerId: number | null
  selectedCustomerLabel: string
  selectedCustomer: CustomerRecord | null
  activeTab: WorkspaceActiveTab
  showCarInsuranceInWorkspace: boolean
  showContractSignaturesInWorkspace: boolean
  showClaimsInWorkspace: boolean
  showGaExcelEntry: boolean
  /** 설정 미완료 등 안내용(버튼은 항상 활성 — 고객 선택 시) */
  gaExcelMenuTitleHint: string | undefined
  onClickFiles: () => void
  onClickConsultations: () => void
  onClickPremiumPayments: () => void
  onClickCarForm: () => void
  onClickGaExcel: () => void
  onClickMemos: () => void
  onClickClaims: () => void
  onClickPersonalMessage: () => void
  onClickSignatures: () => void
  onClickViewOnMap: () => void
  /** 좌측 `CustomersPage` 가 `handleOpenRelatedCustomer` 를 등록한다. 최근 등록 고객 패널 등에서 재사용. */
  openRelatedCustomerRef: MutableRefObject<
    ((customerId: number, customerName?: string) => void) | null
  >
}

/**
 * 우측 패널 제목은 현재 URL path 로부터 1:1 로 파생된다(단일 진실 원천).
 * 제목 케이스를 추가하고 싶다면 경로 규약(`/:customerId/:tab`)을 먼저 정의하고
 * 이 함수와 `resolveWorkspacePathTab` 두 곳만 함께 업데이트하면 된다.
 */
function rightTitle(pathname: string): string {
  if (/\/customers\/\d+\/map(?:\/|$)/.test(pathname)) {
    return '선택 고객 지도'
  }
  if (pathname.includes('/auto-form')) {
    return '자동차 신청서'
  }
  if (pathname.includes('/application-documents')) {
    return '신청서 작성'
  }
  if (pathname.includes('/signatures')) {
    return '전자서명'
  }
  if (pathname.includes('/files')) {
    return '고객 파일 작업'
  }
  if (pathname.includes('/consultations')) {
    return '고객 상담 작업'
  }
  if (pathname.includes('/premium-payments')) {
    return '카드 수납'
  }
  if (pathname.includes('/ga-excel')) {
    return 'GA 고객 데이터'
  }
  if (pathname.includes('/memos')) {
    return '고객 메모'
  }
  if (pathname.includes('/claim-requests')) {
    return '청구 관리'
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
  selectedCustomer,
  activeTab,
  showCarInsuranceInWorkspace,
  showContractSignaturesInWorkspace,
  showClaimsInWorkspace,
  showGaExcelEntry,
  gaExcelMenuTitleHint,
  onClickFiles,
  onClickConsultations,
  onClickPremiumPayments,
  onClickCarForm,
  onClickGaExcel,
  onClickMemos,
  onClickClaims,
  onClickPersonalMessage,
  onClickSignatures,
  onClickViewOnMap,
  openRelatedCustomerRef,
}: CustomerWorkspaceLayoutPCProps) {
  const genderLabel =
    selectedCustomer?.gender === 'male'
      ? '남'
      : selectedCustomer?.gender === 'female'
        ? '여'
        : '미지'
  const insuranceAgeLabel =
    selectedCustomer?.insuranceAge != null && Number.isFinite(selectedCustomer.insuranceAge)
      ? `보험나이 ${selectedCustomer.insuranceAge}세`
      : null
  const isCustomerIndexPath = pathname === '/customers' || pathname === '/customers/'

  return (
    <section className="customer-workspace-layout__right" aria-label="고객 연동 작업영역">
      <header className="customer-workspace-layout__right-header">
        <div className="customer-workspace-layout__summary-row">
          {selectedCustomerId ? (
            <div className="customer-workspace-layout__summary-inner">
              <p className="customer-workspace-layout__summary-line">
                <span className="customer-workspace-layout__summary-name">
                  {selectedCustomerLabel || '선택 고객'}
                </span>
                <span className="customer-workspace-layout__summary-sep" aria-hidden>
                  ·
                </span>
                <span>{genderLabel}</span>
                {insuranceAgeLabel ? (
                  <>
                    <span className="customer-workspace-layout__summary-sep" aria-hidden>
                      ·
                    </span>
                    <span>{insuranceAgeLabel}</span>
                  </>
                ) : null}
              </p>
              <CustomerHeaderAppLinkCompact
                key={selectedCustomerId}
                customerId={selectedCustomerId}
                customerName={selectedCustomer?.name ?? selectedCustomerLabel}
                customerPhone={selectedCustomer?.phone ?? selectedCustomer?.phoneNumber ?? ''}
              />
            </div>
          ) : (
            <p className="customer-workspace-layout__summary-line customer-workspace-layout__summary-line--empty">
              {isCustomerIndexPath ? '고객을 선택해 주세요.' : rightTitle(pathname)}
            </p>
          )}
        </div>

        <nav className="customer-workspace-layout__tab-row" aria-label="고객 작업 메뉴">
          <div className="customer-workspace-layout__tab-bar" role="tablist">
            <FormButton
              htmlType="button"
              variant="action"
              className={`customer-workspace-layout__tab${
                activeTab === 'map' ? ' customer-workspace-layout__tab--active' : ''
              }`}
              disabled={!selectedCustomerId}
              onClick={onClickViewOnMap}
            >
              지도에서 보기
            </FormButton>
            {showClaimsInWorkspace ? (
              <FormButton
                htmlType="button"
                variant="action"
                className={`customer-workspace-layout__tab${
                  activeTab === 'personal-message' ? ' customer-workspace-layout__tab--active' : ''
                }`}
                disabled={!selectedCustomerId}
                onClick={onClickPersonalMessage}
              >
                개인메시지
              </FormButton>
            ) : null}
            <FormButton
              htmlType="button"
              variant="action"
              className={`customer-workspace-layout__tab${
                activeTab === 'files' ? ' customer-workspace-layout__tab--active' : ''
              }`}
              disabled={!selectedCustomerId}
              onClick={onClickFiles}
            >
              고객 파일
            </FormButton>
            <FormButton
              htmlType="button"
              variant="action"
              className={`customer-workspace-layout__tab${
                activeTab === 'consultations' ? ' customer-workspace-layout__tab--active' : ''
              }`}
              disabled={!selectedCustomerId}
              onClick={onClickConsultations}
            >
              상담 이력
            </FormButton>
            {showCarInsuranceInWorkspace ? (
              <FormButton
                htmlType="button"
                variant="action"
                className={`customer-workspace-layout__tab${
                  activeTab === 'pdf-documents' ? ' customer-workspace-layout__tab--active' : ''
                }`}
                disabled={!selectedCustomerId}
                onClick={onClickCarForm}
              >
                신청서
              </FormButton>
            ) : null}
            {showContractSignaturesInWorkspace ? (
              <FormButton
                htmlType="button"
                variant="action"
                className={`customer-workspace-layout__tab${
                  activeTab === 'signatures' ? ' customer-workspace-layout__tab--active' : ''
                }`}
                disabled={!selectedCustomerId}
                title={!selectedCustomerId ? '고객을 선택해 주세요.' : undefined}
                onClick={onClickSignatures}
              >
                전자서명
              </FormButton>
            ) : null}
            {showGaExcelEntry ? (
              <FormButton
                htmlType="button"
                variant="action"
                className={`customer-workspace-layout__tab${
                  activeTab === 'ga-excel' ? ' customer-workspace-layout__tab--active' : ''
                }`}
                disabled={!selectedCustomerId}
                title={gaExcelMenuTitleHint}
                onClick={onClickGaExcel}
              >
                GA 고객 데이터 보기
              </FormButton>
            ) : null}
            <FormButton
              htmlType="button"
              variant="action"
              className={`customer-workspace-layout__tab${
                activeTab === 'memos' ? ' customer-workspace-layout__tab--active' : ''
              }`}
              disabled={!selectedCustomerId}
              onClick={onClickMemos}
            >
              메모 보기
            </FormButton>
            {showClaimsInWorkspace ? (
              <FormButton
                htmlType="button"
                variant="action"
                className={`customer-workspace-layout__tab${
                  activeTab === 'claims' ? ' customer-workspace-layout__tab--active' : ''
                }`}
                disabled={!selectedCustomerId}
                onClick={onClickClaims}
              >
                청구관리
              </FormButton>
            ) : null}
            <FormButton
              htmlType="button"
              variant="action"
              className={`customer-workspace-layout__tab${
                activeTab === 'premium-payments' ? ' customer-workspace-layout__tab--active' : ''
              }`}
              disabled={!selectedCustomerId}
              onClick={onClickPremiumPayments}
            >
              카드 수납
            </FormButton>
          </div>
        </nav>
      </header>

      <div className="customer-workspace-layout__right-body">
        {selectedCustomerId || isCustomerIndexPath ? (
          /**
           * 고객 id 를 자식 서브트리 `key` 로 선언(routing-ssot.mdc 7).
           * 다중 래퍼 아래에서 `useEffect` deps 누락이 있어도 "전 고객 데이터 잔존" 회귀를
           * 막기 위한 방어 레이어. 같은 고객 내부의 탭 전환은 key 값이 동일하므로 자연 교체된다.
           *
           * 고객 미선택 index(`/customers`) 에서는 Outlet 을 렌더해 최근 등록 고객 패널을 보여준다.
           */
          <Outlet
            key={selectedCustomerId ?? 'customer-index'}
            context={{ selectedCustomerId, openRelatedCustomerRef }}
          />
        ) : (
          <EmptyState message="고객을 선택해 주세요." />
        )}
      </div>
    </section>
  )
}

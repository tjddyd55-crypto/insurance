import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MutableRefObject } from 'react'
import { Outlet } from 'react-router-dom'
import { EmptyState } from '../../../../components/feedback'
import { FormButton } from '../../../../components/form'
import { useAuth } from '../../../auth/AuthProvider'
import { getCustomerAppLink, type CustomerAppLinkInfo } from '../../../claim-requests/api/claimRequestsApi'
import type { CustomerRecord } from '../../domain/types'
import './CustomerWorkspaceLayoutPC.css'

type WorkspaceActiveTab =
  | 'files'
  | 'consultations'
  | 'auto'
  | 'ga-excel'
  | 'memos'
  | 'claims'
  | 'personal-message'
  | null

export type CustomerWorkspaceLayoutPCProps = {
  pathname: string
  selectedCustomerId: number | null
  selectedCustomerLabel: string
  selectedCustomer: CustomerRecord | null
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
  onClickClaims: () => void
  onClickPersonalMessage: () => void
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
  if (pathname.includes('/claim-requests')) {
    return '청구 관리'
  }
  return '작업 영역'
}

function resolveClaimLink(linkStatus: CustomerAppLinkInfo | null): string {
  return String(linkStatus?.universalUrl ?? linkStatus?.connectUrl ?? '').trim()
}

function isCustomerAppConnected(linkStatus: CustomerAppLinkInfo | null): boolean {
  if (!linkStatus) {
    return false
  }
  if (linkStatus.connectionState === 'connected') {
    return true
  }
  return Boolean(linkStatus.lastConnectedAt) || Number(linkStatus.deviceCount ?? 0) > 0
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
  showGaExcelEntry,
  gaExcelEnabledForDesigner,
  gaExcelDisabledReason,
  onClickFiles,
  onClickConsultations,
  onClickCarForm,
  onClickGaExcel,
  onClickMemos,
  onClickClaims,
  onClickPersonalMessage,
  openRelatedCustomerRef,
}: CustomerWorkspaceLayoutPCProps) {
  const { token } = useAuth()
  const [claimLinkStatus, setClaimLinkStatus] = useState<CustomerAppLinkInfo | null>(null)
  const [claimLinkLoading, setClaimLinkLoading] = useState(false)
  const [claimLinkCopyResult, setClaimLinkCopyResult] = useState('')

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
  const isClaimsTab = activeTab === 'claims'
  const claimLinkUrl = useMemo(() => resolveClaimLink(claimLinkStatus), [claimLinkStatus])
  const claimAppConnected = useMemo(() => isCustomerAppConnected(claimLinkStatus), [claimLinkStatus])

  useEffect(() => {
    if (!isClaimsTab || !selectedCustomerId || !token?.trim()) {
      setClaimLinkStatus(null)
      setClaimLinkCopyResult('')
      return
    }
    let cancelled = false
    setClaimLinkLoading(true)
    void getCustomerAppLink(token, selectedCustomerId)
      .then((status) => {
        if (!cancelled) {
          setClaimLinkStatus(status)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClaimLinkStatus(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setClaimLinkLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [isClaimsTab, selectedCustomerId, token])

  useEffect(() => {
    if (!claimLinkCopyResult) {
      return
    }
    const timer = window.setTimeout(() => setClaimLinkCopyResult(''), 2500)
    return () => window.clearTimeout(timer)
  }, [claimLinkCopyResult])

  const handleCopyClaimLink = useCallback(async () => {
    if (!claimLinkUrl) {
      setClaimLinkCopyResult('복사할 연결 링크가 없습니다.')
      return
    }
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('clipboard API unavailable')
      }
      await navigator.clipboard.writeText(claimLinkUrl)
      setClaimLinkCopyResult('연결 링크 복사 완료')
    } catch {
      setClaimLinkCopyResult('연결 링크 복사 실패')
    }
  }, [claimLinkUrl])

  return (
    <section className="customer-workspace-layout__right" aria-label="고객 연동 작업영역">
      <header className="customer-workspace-layout__right-header">
        <div className="customer-workspace-layout__customer-meta">
          <div className="customer-workspace-layout__title-row">
            <h2 className="customer-workspace-layout__title">
              {selectedCustomerId ? selectedCustomerLabel || `고객 #${selectedCustomerId}` : rightTitle(pathname)}
              {selectedCustomerId ? (
                <span className="customer-workspace-layout__title-sub">
                  {genderLabel}
                  {insuranceAgeLabel ? ` · ${insuranceAgeLabel}` : ''}
                </span>
              ) : null}
            </h2>
            {selectedCustomerId && isClaimsTab ? (
              <div className="customer-workspace-layout__claim-link-tools" aria-label="고객앱 연결 링크">
                <span
                  className={`customer-workspace-layout__claim-status${claimAppConnected ? ' customer-workspace-layout__claim-status--connected' : ' customer-workspace-layout__claim-status--disconnected'}`}
                  title={claimLinkLoading ? '연결 상태 확인 중' : undefined}
                >
                  앱 {claimAppConnected ? '연결됨' : '미연결'}
                </span>
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  size="sm"
                  disabled={!claimLinkUrl}
                  onClick={handleCopyClaimLink}
                  title={claimLinkUrl || '생성된 연결 링크가 없습니다.'}
                >
                  연결 링크 복사
                </FormButton>
                {claimLinkCopyResult ? (
                  <span className="customer-workspace-layout__claim-copy-result">{claimLinkCopyResult}</span>
                ) : null}
              </div>
            ) : null}
          </div>
          <p className="customer-workspace-layout__subtitle">
            {selectedCustomerId
              ? `생년월일 ${selectedCustomer?.ssn || '-'} · 상담일 ${selectedCustomer?.lastConsultDate || '-'} · 연락처 ${
                  selectedCustomer?.phone || '-'
                }`
              : '고객을 선택해 주세요.'}
          </p>
        </div>
        <div className="customer-workspace-layout__actions">
          <FormButton
            htmlType="button"
            variant="action"
            className={`filter-button${activeTab === 'personal-message' ? ' filter-button--workspace-active' : ''}`}
            disabled={!selectedCustomerId}
            onClick={onClickPersonalMessage}
          >
            개인메시지
          </FormButton>
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
          <FormButton
            htmlType="button"
            variant="action"
            className={`filter-button${activeTab === 'claims' ? ' filter-button--workspace-active' : ''}`}
            disabled={!selectedCustomerId}
            onClick={onClickClaims}
          >
            청구관리
          </FormButton>
        </div>
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

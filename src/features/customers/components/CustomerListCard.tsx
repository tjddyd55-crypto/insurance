import { memo, useState, type Dispatch, type FormEvent, type KeyboardEvent, type SetStateAction } from 'react'
import { EXPANDABLE_CARD_INVALID_ID, useExpandableCard } from '../../../hooks/useExpandableCard'
import { FormButton, FormInput } from '../../../components/form'
import type { CustomerRecord } from '../domain/types'
import { getCustomerListMetrics } from '../utils/customerListMetrics'
import { formatDateYmdInput } from '../utils/insuranceInfo'
import type { CustomerEditFormState } from '../types/customerEditForm'
import CustomerDetailReadView from './CustomerDetailReadView'
import CustomerEditForm from './CustomerEditForm'
import { CustomerWorkspaceActions } from './CustomerWorkspaceActions'
function customerInsuranceDisplay(c: CustomerRecord): {
  ageText: string
  dateText: string
  maturityYmd: string | null
  insuranceAgeNum: number | null
} {
  const m = getCustomerListMetrics(c)
  return {
    ageText: m.insuranceAge != null ? `${m.insuranceAge}세` : '—',
    dateText: m.maturityYmd ?? '—',
    maturityYmd: m.maturityYmd,
    insuranceAgeNum: m.insuranceAge,
  }
}

function genderSummaryLabel(c: CustomerRecord): string {
  if (c.gender === 'male') {
    return '남'
  }
  if (c.gender === 'female') {
    return '여'
  }
  return '—'
}

function customerPhoneHref(phone: string | undefined, scheme: 'tel' | 'sms'): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length < 8) {
    return null
  }
  return `${scheme}:${digits}`
}

/** 카드 상단: API가 phone / phoneNumber / phone_number 중 무엇으로 주든 통일 */
function resolveCustomerListPhone(
  customer: CustomerRecord & { phoneNumber?: unknown; phone_number?: unknown },
): string {
  const raw = customer.phoneNumber ?? customer.phone_number ?? customer.phone ?? ''
  if (raw == null) {
    return ''
  }
  return typeof raw === 'string' ? raw : String(raw)
}

/**
 * 전화 아이콘 — 이모지(📞)는 OS/브라우저에서 멀티컬러 비트맵으로 그려져 `color`/`text-*`가
 * 적용되지 않는 경우가 많음. SVG + currentColor로 테마·부모 링크와 분리해 색을 준다.
 */
function CustomerListTelSvg({
  hasPhone,
  withLinkHover,
}: {
  hasPhone: boolean
  withLinkHover?: boolean
}) {
  const tone = hasPhone
    ? withLinkHover
      ? 'h-5 w-5 shrink-0 !text-green-500 transition-colors group-hover:!text-green-400 active:!text-green-600'
      : 'h-5 w-5 shrink-0 !text-green-500 transition-colors'
    : 'h-5 w-5 shrink-0 text-gray-400 transition-colors'
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={tone}
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

export type CustomerSsnDupHighlight = {
  groupLabel: number
  color: string
}

export type { CustomerEditFormState }

export type CustomerListCardProps = {
  customer: CustomerRecord
  ssnDupHighlight: CustomerSsnDupHighlight | undefined
  isSelectMode: boolean
  selectedCustomerIds: string[]
  setSelectedCustomerIds: Dispatch<SetStateAction<string[]>>
  expandedId: number | null
  setExpandedId: Dispatch<SetStateAction<number | null>>
  onSelectCustomer: (c: CustomerRecord) => void
  editingId: number | null
  editForm: CustomerEditFormState | null
  setEditForm: Dispatch<SetStateAction<CustomerEditFormState | null>>
  onEditSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>
  carFeatureEnabled: boolean
  gaExcelEnabled: boolean
  onCopyCustomer: (c: CustomerRecord) => void
  onStartEdit: (c: CustomerRecord) => void
  onCancelEdit: () => void
  onDeleteCustomer: (c: CustomerRecord) => void
  onOpenFilesModal: (customerId: number) => void
  onOpenConsultationsModal: (customerId: number) => void
  onOpenAutoModal: (customerId: number) => void
  onOpenGaModal: (customerId: number) => void
  onOpenPersonalMessage: (customerId: number) => void
  onOpenClaims: (customerId: number) => void
  onOpenRelatedCustomer: (customerId: number, customerName?: string) => void
  token: string | null
  onToggleFavorite: (c: CustomerRecord) => void | Promise<void>
  /**
   * PC/Mobile 분기를 컴포넌트 내부 `useIsMobile()` 호출이 아니라 부모에서 내려주는
   * 명시적 variant 로 받는다 (AGENTS.md §8-5 Tier 4).
   * 상위 `CustomersPage` 는 이미 동일 세션에서 `isMobile` 을 계산해 View 를 분기하므로,
   * 자식 카드는 그 값을 그대로 내려받아 쓰면 된다 — 훅이 여러 곳에서 중복 호출되지 않는다.
   */
  variant: 'pc' | 'mobile'
}

const CustomerListCard = memo(function CustomerListCard({
  customer: c,
  ssnDupHighlight,
  isSelectMode,
  selectedCustomerIds,
  setSelectedCustomerIds,
  expandedId,
  setExpandedId,
  onSelectCustomer,
  editingId,
  editForm,
  setEditForm,
  onEditSubmit,
  carFeatureEnabled,
  gaExcelEnabled,
  onCopyCustomer,
  onStartEdit,
  onCancelEdit,
  onDeleteCustomer,
  onOpenFilesModal,
  onOpenConsultationsModal,
  onOpenAutoModal,
  onOpenGaModal,
  onOpenPersonalMessage,
  onOpenClaims,
  onOpenRelatedCustomer,
  token,
  onToggleFavorite,
  variant,
}: CustomerListCardProps) {
  const isMobile = variant === 'mobile'
  const [mobileInfoExpanded, setMobileInfoExpanded] = useState(false)
  const validCustomerId =
    c != null &&
    typeof c === 'object' &&
    typeof c.id === 'number' &&
    Number.isFinite(c.id)
      ? c.id
      : null

  const expandableCardId = validCustomerId ?? EXPANDABLE_CARD_INVALID_ID
  const {
    expanded,
    detailClosing,
    showExpandedChrome,
    toggleExpanded,
    handleDetailTransitionEnd,
  } = useExpandableCard({
    cardId: expandableCardId,
    expandedId,
    setExpandedId,
    interactionDisabled: isSelectMode,
  })

  if (
    c == null ||
    typeof c !== 'object' ||
    typeof c.id !== 'number' ||
    !Number.isFinite(c.id)
  ) {
    console.error('[CustomerListCard] Invalid customer render:', c)
    return null
  }

  const ins = customerInsuranceDisplay(c)
  const recentConsultText = c.lastConsultDate ? formatDateYmdInput(c.lastConsultDate) : '-'
  const phone = resolveCustomerListPhone(c)
  const hasPhone = typeof phone === 'string' && phone.trim() !== ''
  const smsHref = customerPhoneHref(phone, 'sms')
  const telHref = customerPhoneHref(phone, 'tel')

  function handleSummaryKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (isSelectMode) {
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleExpanded()
      onSelectCustomer(c)
    }
  }
  return (
    <li
      id={`customer-${c.id}`}
      data-customer-id={c.id}
      className={`record-card customer-card customer-expand-card transition-all duration-150 ease-out${
        isSelectMode ? ' customer-expand-card--select-mode' : ''
      }${expanded ? ' customer-expand-card--focal' : ''}`}
      data-customer-card-id={c.id}
    >
      {isSelectMode ? (
        <div className="customer-expand-card__select">
          <FormInput
            type="checkbox"
            checked={selectedCustomerIds.includes(String(c.id))}
            onChange={() => {
              const id = String(c.id)
              setSelectedCustomerIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
              )
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label={`${c.name} 선택`}
          />
        </div>
      ) : null}
      <div className="customer-expand-card__main">
        <div
          className={`customer-expand-summary${isSelectMode ? '' : ' customer-expand-summary--toggle transition-transform duration-100 ease-out active:scale-[0.98]'}`}
          role={isSelectMode ? undefined : 'button'}
          tabIndex={isSelectMode ? undefined : 0}
          aria-expanded={isSelectMode ? undefined : showExpandedChrome}
          aria-label={
            isSelectMode ? undefined : `${c.name} 상세 ${showExpandedChrome ? '접기' : '펼치기'}`
          }
          onClick={() => {
            toggleExpanded()
            onSelectCustomer(c)
          }}
          onKeyDown={handleSummaryKeyDown}
        >
          <span className="customer-expand-summary__content w-full min-w-0">
            <div className="flex justify-between items-center gap-2 w-full min-w-0">
              <div className="min-w-0 flex-1">
                <div className="customer-card-text-name flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={`customer-card-name-primary font-semibold${ssnDupHighlight ? ' customer-name-ssn-dup' : ''}`}
                    style={ssnDupHighlight ? { color: ssnDupHighlight.color } : undefined}
                  >
                    {ssnDupHighlight ? (
                      <span
                        className="customer-name-ssn-dup__badge"
                        aria-label={`중복 그룹 ${ssnDupHighlight.groupLabel}`}
                      >
                        [{ssnDupHighlight.groupLabel}]
                      </span>
                    ) : null}
                    {c.name}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)] font-normal">
                    {genderSummaryLabel(c)}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)] font-normal">
                    보험나이 {ins.ageText}
                  </span>
                </div>
                <div className="text-sm text-[var(--text-secondary)] customer-card-summary-meta mt-0.5">
                  상령일: {ins.dateText} · 상담일: {recentConsultText}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className="customer-card__actions"
                  role="presentation"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <div className="icon-box">
                    <FormButton
                      htmlType="button"
                      variant="action"
                      className="text-lg leading-none disabled:opacity-50"
                      aria-label={c.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
                      aria-pressed={c.isFavorite}
                      disabled={!token?.trim()}
                      onClick={(e) => {
                        e.stopPropagation()
                        void onToggleFavorite(c)
                      }}
                    >
                      {c.isFavorite ? (
                        <span className="text-yellow-400" aria-hidden>
                          ★
                        </span>
                      ) : (
                        <span className="text-gray-400" aria-hidden>
                          ☆
                        </span>
                      )}
                    </FormButton>
                  </div>
                  {/* 전화/문자 아이콘은 모바일(터치 디바이스)에서만 의미가 있어 PC에서는 DOM 자체를 넣지 않는다.
                      CSS display:none 대신 조건부 렌더로 의도를 명시해 향후 유틸리티 override 위험을 제거한다. */}
                  {isMobile ? (
                    <>
                      <div className="icon-box icon-box--sms">
                        {smsHref ? (
                          <a
                            href={smsHref}
                            className="text-lg text-blue-500 leading-none"
                            aria-label="문자 보내기"
                            onClick={(e) => e.stopPropagation()}
                          >
                            💬
                          </a>
                        ) : (
                          <span className="text-lg opacity-35 grayscale" aria-hidden>
                            💬
                          </span>
                        )}
                      </div>
                      <div className="icon-box icon-box--tel">
                        {telHref ? (
                          <a
                            href={telHref}
                            className="group transition-opacity hover:opacity-90 active:opacity-80"
                            aria-label="전화 걸기"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <CustomerListTelSvg hasPhone withLinkHover />
                          </a>
                        ) : (
                          <span aria-hidden>
                            <CustomerListTelSvg hasPhone={hasPhone} />
                          </span>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
                <span className="customer-expand-summary__hint" aria-hidden="true">
                  {showExpandedChrome ? '▲' : '▼'}
                </span>
              </div>
            </div>
          </span>
        </div>

        <div
            className={`customer-expand-detail${detailClosing ? ' customer-expand-detail--closing' : ''}`}
            hidden={!expanded && !detailClosing}
            onClick={(e) => e.stopPropagation()}
            onTransitionEnd={handleDetailTransitionEnd}
          >
            {!(editingId === c.id && editForm) && isMobile ? (
              <>
                <CustomerWorkspaceActions
                  variant="mobile"
                  customerId={c.id}
                  carFeatureEnabled={carFeatureEnabled}
                  gaExcelEnabled={gaExcelEnabled}
                  onOpenFilesModal={onOpenFilesModal}
                  onOpenConsultationsModal={onOpenConsultationsModal}
                  onOpenAutoModal={onOpenAutoModal}
                  onOpenGaModal={onOpenGaModal}
                  onOpenPersonalMessage={onOpenPersonalMessage}
                  onOpenClaims={onOpenClaims}
                />
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  className="button button--secondary button--full customer-detail-toggle-btn"
                  onClick={() => setMobileInfoExpanded((prev) => !prev)}
                >
                  {mobileInfoExpanded ? '고객 정보 접기 ▲' : '고객 정보 펼치기 ▼'}
                </FormButton>
              </>
            ) : null}

            {!isMobile || mobileInfoExpanded ? (
              <>
                <div className="customer-detail-toolbar">
                  <div className="customer-detail-toolbar__title">
                    <span className="customer-info-label">
                      <span className="customer-info-label__icon" aria-hidden>
                        👤
                      </span>
                      {c.name}
                    </span>
                  </div>
                  <div className="customer-detail-action-bar">
                    <FormButton
                      htmlType="button"
                      variant="secondary"
                      size="sm"
                      className="customer-detail-action-button"
                      title="카톡 복사 형식으로 복사"
                      aria-label="복사"
                      onClick={() => void onCopyCustomer(c)}
                    >
                      복사
                    </FormButton>
                    {editingId !== c.id ? (
                      <FormButton
                        htmlType="button"
                        variant="secondary"
                        size="sm"
                        className="customer-detail-action-button"
                        title="고객 정보 수정"
                        aria-label="수정"
                        onClick={() => onStartEdit(c)}
                      >
                        수정
                      </FormButton>
                    ) : null}
                    <FormButton
                      htmlType="button"
                      variant="danger"
                      size="sm"
                      className="customer-detail-action-button customer-detail-action-button--danger"
                      title="고객 삭제"
                      aria-label="삭제"
                      onClick={() => void onDeleteCustomer(c)}
                    >
                      삭제
                    </FormButton>
                  </div>
                </div>
                {editingId === c.id && editForm ? (
                  <CustomerEditForm
                    customerId={c.id}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    onEditSubmit={onEditSubmit}
                    onCancelEdit={onCancelEdit}
                  />
                ) : (
                  <CustomerDetailReadView
                    customer={c}
                    ins={ins}
                    token={token}
                    expandedId={expandedId}
                    fetchCarsEnabled={expanded && editingId !== c.id}
                    onOpenRelatedCustomer={onOpenRelatedCustomer}
                  />
                )}
              <div className="customer-expand-section-divider" role="presentation" />
            </>
          ) : null}
          </div>
      </div>
    </li>
  )
})

export default CustomerListCard

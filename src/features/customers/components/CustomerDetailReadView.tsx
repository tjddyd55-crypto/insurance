import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { CustomerRecord } from '../domain/types'
import {
  CUSTOMER_DETAIL_CORE_SECTIONS,
  CUSTOMER_DETAIL_DEFAULT_OPEN_SECTION,
  type CustomerDetailCoreSectionId,
} from '../config/customerDetailCoreSectionOrder'
import { normalizeCustomerNotesBag } from '../domain/types'
import { getDDay, getDDayBadgeClass } from '../utils/dday'
import {
  formatCustomerGenderReadLabel,
  formatCustomerMobileCarrierDisplay,
  formatCustomerPhoneUi,
  formatCustomerSsnUi,
} from '../utils/customerDisplayFormat'
import { CustomerMedicalHistoryReadSection } from './CustomerMedicalHistoryRead'
import { resolveMedicalHistoryFromCustomer } from '../utils/customerMedicalHistory'
import {
  formatCustomerInflowSourceDisplay,
  getInflowSourceDetailFieldMeta,
} from '../config/customerInflowSource.config'
import { CustomerCopyButton } from './CustomerAccountNumberField'
import { CustomerBusinessQuickSection } from './detail-quick-crud/CustomerBusinessQuickSection'
import { CustomerCarsQuickSection } from './detail-quick-crud/CustomerCarsQuickSection'
import { CustomerFireInsuranceQuickSection } from './detail-quick-crud/CustomerFireInsuranceQuickSection'
import { CustomerSpecialDatesQuickSection } from './detail-quick-crud/CustomerSpecialDatesQuickSection'
import { CustomerBasicInlineCustomFieldsRead } from './CustomerBasicInlineCustomFieldsRead'
import { CustomerDetailAccordionSection } from './CustomerDetailAccordionSection'
import { CustomerRelationsStrip } from './CustomerRelationsStrip'
import type { CustomerIndustryTemplate } from '../../customer-templates/customerTemplate.types'
import { governmentDetailSummaryRows, isGovernmentIndustryTemplate, buildGovernmentProgressMvp } from '../utils/governmentCustomerUi'
import { industryTemplateReadPreviewRows, industryTemplateReadPreviewRowsForFieldKeys } from '../utils/industryCustomerReadSummary'
import {
  buildGovernmentCustomerStatusSummary,
  buildGovernmentDetailStatusCardRows,
} from '../utils/governmentCustomerStatusSummary'
import { CustomerSmsOptOutReadBadge } from './CustomerSmsOptOutReadBadge'
import GovernmentProgressReadSection from './GovernmentProgressReadSection'
import { applyAccordionScrollCompensation } from '../utils/customerDetailAccordionScroll'
import { resolveCustomerListScrollContainer } from '../utils/resolveCustomerListScrollContainer'

export type CustomerDetailInsuranceDisplay = {
  ageText: string
  dateText: string
  maturityYmd: string | null
  insuranceAgeNum: number | null
}

function MaturityDdayBadge({ maturityYmd }: { maturityYmd: string | null }) {
  if (!maturityYmd) {
    return null
  }
  const dday = getDDay(maturityYmd)
  if (dday === null) {
    return null
  }
  const hot = dday >= 0 && dday <= 30
  const label = `D-${dday}`
  const toneClass = hot ? getDDayBadgeClass(dday) : 'customer-dday'
  return <span className={`customer-detail-read__dday-inline ${toneClass}`}>({label})</span>
}

function DetailReadInfoRow({ children, rowClassName }: { children: ReactNode; rowClassName?: string }) {
  return (
    <div className={`customer-detail-read__info-row${rowClassName ? ` ${rowClassName}` : ''}`}>
      <span className="customer-detail-read__info-bullet" aria-hidden>
        •
      </span>
      <div className="customer-detail-read__info-main">{children}</div>
    </div>
  )
}

type CustomerDetailReadViewProps = {
  customer: CustomerRecord
  ins: CustomerDetailInsuranceDisplay
  token: string | null
  expandedId: number | null
  /** 펼친 읽기 모드에서만 customer_cars API 조회 */
  fetchCarsEnabled: boolean
  onOpenRelatedCustomer: (customerId: number, customerName?: string) => void
  onStartEditBasic?: () => void
  onCustomerUpdated?: (customer: CustomerRecord) => void
  crmIsInsuranceLayout: boolean
  crmIndustryTemplate: CustomerIndustryTemplate
}

export default function CustomerDetailReadView({
  customer: c,
  ins,
  token,
  expandedId,
  fetchCarsEnabled,
  onOpenRelatedCustomer,
  onStartEditBasic,
  onCustomerUpdated,
  crmIsInsuranceLayout,
  crmIndustryTemplate,
}: CustomerDetailReadViewProps) {
  const [openSections, setOpenSections] = useState<Record<CustomerDetailCoreSectionId, boolean>>(() => ({
    basic: CUSTOMER_DETAIL_DEFAULT_OPEN_SECTION === 'basic',
    vehicle: false,
    linked: false,
    fireInsurance: false,
    business: false,
    alertDates: false,
  }))
  const sectionRefs = useRef<Partial<Record<CustomerDetailCoreSectionId, HTMLElement | null>>>({})
  const pendingScrollRef = useRef<{
    sectionId: CustomerDetailCoreSectionId
    beforeTop: number
  } | null>(null)

  const setSectionOpen = useCallback((sectionId: CustomerDetailCoreSectionId, expanded: boolean) => {
    const sectionEl = sectionRefs.current[sectionId]
    pendingScrollRef.current = {
      sectionId,
      beforeTop: sectionEl?.getBoundingClientRect().top ?? 0,
    }
    setOpenSections((previous) => {
      if (!expanded) {
        return { ...previous, [sectionId]: false }
      }
      return {
        basic: sectionId === 'basic',
        vehicle: sectionId === 'vehicle',
        linked: sectionId === 'linked',
        fireInsurance: sectionId === 'fireInsurance',
        business: sectionId === 'business',
        alertDates: sectionId === 'alertDates',
      }
    })
  }, [])

  useLayoutEffect(() => {
    const pending = pendingScrollRef.current
    if (!pending) {
      return
    }
    pendingScrollRef.current = null
    const sectionEl = sectionRefs.current[pending.sectionId]
    if (!sectionEl) {
      return
    }
    const container = resolveCustomerListScrollContainer(sectionEl)
    if (!container) {
      return
    }
    applyAccordionScrollCompensation({
      container,
      beforeTop: pending.beforeTop,
      target: sectionEl,
    })
  }, [openSections])
  if (!crmIsInsuranceLayout) {
    const dynTabs = [...crmIndustryTemplate.detailTabs]
      .filter((t) => t.visibleDefault !== false)
      .filter((t) => Array.isArray(t.fieldKeys) && t.fieldKeys.length > 0)
      .sort((a, b) => a.order - b.order)

    const fallbackRows = industryTemplateReadPreviewRows(c, crmIndustryTemplate, 28)
    const govSummaryRows = isGovernmentIndustryTemplate(crmIndustryTemplate)
      ? governmentDetailSummaryRows(c, crmIndustryTemplate)
      : null
    const govProgressModel = isGovernmentIndustryTemplate(crmIndustryTemplate)
      ? buildGovernmentProgressMvp(c, crmIndustryTemplate)
      : null
    const govStatusSummary = isGovernmentIndustryTemplate(crmIndustryTemplate)
      ? buildGovernmentCustomerStatusSummary(c, crmIndustryTemplate)
      : null
    const govStatusCardRows =
      govStatusSummary != null ? buildGovernmentDetailStatusCardRows(c, crmIndustryTemplate, govStatusSummary) : []

    return (
      <div className="customer-detail-read">
        {govStatusSummary != null ? (
          <GovernmentDetailStatusSummaryCard summary={govStatusSummary} rows={govStatusCardRows} />
        ) : null}
        {govSummaryRows != null && govSummaryRows.length > 0 ? (
          <section className="customer-detail-read__section" aria-labelledby="gov-ops-summary-heading">
            <div className="customer-detail-read__section-header">
              <h4 id="gov-ops-summary-heading" className="customer-detail-read__section-title">
                지원·접수 현황
              </h4>
            </div>
            <div className="customer-detail-read__section-body">
              <div className="customer-detail-read__info-list">
                {govSummaryRows.map((r) => (
                  <DetailReadInfoRow key={`gov-ops-${r.canonicalKey}`}>
                    <span className="customer-detail-read__info-label">{r.label}:</span>{' '}
                    <span className="customer-detail-read__info-value">{r.value}</span>
                  </DetailReadInfoRow>
                ))}
              </div>
            </div>
          </section>
        ) : null}
        {govProgressModel ? <GovernmentProgressReadSection model={govProgressModel} /> : null}
        {dynTabs.length > 0
          ? dynTabs.map((tab) => {
              const rows = industryTemplateReadPreviewRowsForFieldKeys(
                c,
                crmIndustryTemplate,
                tab.fieldKeys ?? [],
                48,
              )
              return (
                <section key={tab.tabId} className="customer-detail-read__section" aria-labelledby={`tab-${tab.tabId}`}>
                  <div className="customer-detail-read__section-header">
                    <h4 id={`tab-${tab.tabId}`} className="customer-detail-read__section-title">
                      {tab.label}
                    </h4>
                  </div>
                  <div className="customer-detail-read__section-body">
                    {rows.length === 0 ? (
                      <p className="customer-detail-read__api-warn" style={{ margin: 0 }}>
                        이 탭에 표시할 저장 값이 없습니다.
                      </p>
                    ) : (
                      <div className="customer-detail-read__info-list">
                        {rows.map((r) => (
                          <DetailReadInfoRow key={`${tab.tabId}-${r.canonicalKey}`}>
                            <span className="customer-detail-read__info-label">{r.label}:</span>{' '}
                            <span className="customer-detail-read__info-value">{r.value}</span>
                          </DetailReadInfoRow>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )
            })
          : (
              <section className="customer-detail-read__section" aria-labelledby="crm-industry-read-heading">
                <div className="customer-detail-read__section-header">
                  <h4 id="crm-industry-read-heading" className="customer-detail-read__section-title">
                    업종 CRM 저장값 ({crmIndustryTemplate.meta.industryCode})
                  </h4>
                </div>
                <div className="customer-detail-read__section-body">
                  {fallbackRows.length === 0 ? (
                    <p className="customer-detail-read__api-warn" style={{ margin: 0 }}>
                      표시할 저장 필드 값이 없습니다.
                    </p>
                  ) : (
                    <div className="customer-detail-read__info-list">
                      {fallbackRows.map((r) => (
                        <DetailReadInfoRow key={r.canonicalKey}>
                          <span className="customer-detail-read__info-label">{r.label}:</span>{' '}
                          <span className="customer-detail-read__info-value">{r.value}</span>
                        </DetailReadInfoRow>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}
        <div className="customer-detail-read__info-list">
          <DetailReadInfoRow>
            <span className="customer-detail-read__info-label">문자 수신:</span>{' '}
            <CustomerSmsOptOutReadBadge smsOptOut={c.smsOptOut === true} />
          </DetailReadInfoRow>
        </div>
        {token?.trim() ? (
          <CustomerRelationsStrip
            customerId={c.id}
            customerName={c.name}
            token={token}
            focusedCustomerId={expandedId}
            onOpenCustomer={onOpenRelatedCustomer}
          />
        ) : null}
      </div>
    )
  }

  const notes = normalizeCustomerNotesBag(c.notes)
  const inflowDetailMeta = getInflowSourceDetailFieldMeta(c.inflowSource)
  const inflowDetailName = c.referrerName?.trim()

  const sectionById = {
    basic: (
      <div className="customer-detail-read__info-list customer-detail-read__grid">
        <DetailReadInfoRow>
          <span className="customer-detail-read__info-label">고객명:</span>{' '}
          <span className="customer-detail-read__info-value">{c.name || '—'}</span>
        </DetailReadInfoRow>
        <DetailReadInfoRow>
          <span className="customer-detail-read__info-label">연락처:</span>{' '}
          <span className="customer-detail-read__info-value">{formatCustomerPhoneUi(c.phone) || '—'}</span>
        </DetailReadInfoRow>
        <DetailReadInfoRow>
          <div className="customer-detail-read__ssn-gender-cluster">
            <span className="customer-detail-read__ssn-gender-cluster__ssn">
              <span className="customer-detail-read__info-label">주민번호:</span>{' '}
              <span className="customer-detail-read__info-value">{formatCustomerSsnUi(c.ssn) || '—'}</span>
            </span>
            <span className="customer-detail-read__ssn-gender-cluster__gender">
              <span className="customer-detail-read__info-label">성별:</span>{' '}
              <span className="customer-detail-read__info-value">
                {formatCustomerGenderReadLabel(c.gender, c.ssn)}
              </span>
            </span>
          </div>
        </DetailReadInfoRow>
        <DetailReadInfoRow>
          <div className="customer-detail-read__info-main--cluster">
            <span>
              <span className="customer-detail-read__info-label">보험나이:</span>{' '}
              <span className="customer-detail-read__info-value">{ins.ageText}</span>
            </span>
            <span>
              <span className="customer-detail-read__info-label">상령일:</span>{' '}
              <span className="customer-detail-read__info-value">{ins.dateText}</span>
              <MaturityDdayBadge maturityYmd={ins.maturityYmd} />
            </span>
          </div>
        </DetailReadInfoRow>
        <DetailReadInfoRow>
          <span className="customer-detail-read__info-label">문자 수신:</span>{' '}
          <CustomerSmsOptOutReadBadge smsOptOut={c.smsOptOut === true} />
        </DetailReadInfoRow>
        <DetailReadInfoRow>
          <span className="customer-detail-read__info-label">통신사:</span>{' '}
          <span className="customer-detail-read__info-value">
            {formatCustomerMobileCarrierDisplay(c.carrier) || '—'}
          </span>
        </DetailReadInfoRow>
        <DetailReadInfoRow rowClassName="customer-detail-read__grid-span-all">
          <span className="customer-detail-read__info-label">주소:</span>{' '}
          <span className="customer-detail-read__info-value">{c.address || '—'}</span>
        </DetailReadInfoRow>
        <DetailReadInfoRow>
          <span className="customer-detail-read__info-label">키/몸무게:</span>{' '}
          <span className="customer-detail-read__info-value">
            {c.height?.trim() || c.weight?.trim()
              ? `${c.height?.trim() || '—'}/${c.weight?.trim() || '—'}`
              : '—'}
          </span>
        </DetailReadInfoRow>
        <DetailReadInfoRow>
          <span className="customer-detail-read__info-label">직업/회사명/하는일/지역:</span>{' '}
          <span className="customer-detail-read__info-value">{c.job?.trim() || '—'}</span>
        </DetailReadInfoRow>
        <DetailReadInfoRow>
          <span className="customer-detail-read__info-label">운전여부:</span>{' '}
          <span className="customer-detail-read__info-value">
            {c.isDriver === true
              ? '운전함'
              : c.isDriver === false
                ? '운전 안함'
                : c.driving || '—'}
          </span>
        </DetailReadInfoRow>
        <DetailReadInfoRow>
          <span className="customer-detail-read__info-label">유입 경로:</span>{' '}
          <span className="customer-detail-read__info-value">
            {formatCustomerInflowSourceDisplay(c.inflowSource)}
          </span>
        </DetailReadInfoRow>
        {inflowDetailMeta && inflowDetailName ? (
          <DetailReadInfoRow>
            <span className="customer-detail-read__info-label">{inflowDetailMeta.readLabel}:</span>{' '}
            <span className="customer-detail-read__info-value">{inflowDetailName}</span>
          </DetailReadInfoRow>
        ) : null}
        <DetailReadInfoRow rowClassName="customer-detail-read__grid-span-all">
          <CustomerMedicalHistoryReadSection {...resolveMedicalHistoryFromCustomer(c)} />
        </DetailReadInfoRow>
        <div className="customer-detail-read__subsection customer-detail-read__grid-span-all">
          <h5 className="customer-detail-read__subsection-title">보험 가입</h5>
          <div className="customer-insurance-history-body">
            {notes.insuranceHistory?.trim() ? notes.insuranceHistory : '내용 없음'}
          </div>
        </div>
        <div className="customer-detail-read__subsection customer-detail-read__grid-span-all">
          <h5 className="customer-detail-read__subsection-title">계좌</h5>
          <div className="customer-account-number-read">
            <span className="customer-account-number-read__value">
              {notes.accountNumber?.trim() || '내용 없음'}
            </span>
            {notes.accountNumber?.trim() ? (
              <CustomerCopyButton text={notes.accountNumber} ariaLabel="계좌번호 복사" />
            ) : null}
          </div>
        </div>
        <CustomerBasicInlineCustomFieldsRead
          customer={c}
          token={token}
          enabled={fetchCarsEnabled}
        />
        {onStartEditBasic ? (
          <div className="customer-detail-read__section-edit-action customer-detail-read__grid-span-all">
            <button
              type="button"
              className="ui-button ui-button--sm ui-button--secondary customer-detail-read__edit-basic-btn"
              onClick={onStartEditBasic}
            >
              수정하기
            </button>
          </div>
        ) : null}
      </div>
    ),
    vehicle: (
      <CustomerCarsQuickSection
        customer={c}
        token={token}
        enabled={fetchCarsEnabled}
        embedded
      />
    ),
    linked: token?.trim() ? (
      <CustomerRelationsStrip
        customerId={c.id}
        customerName={c.name}
        token={token}
        focusedCustomerId={expandedId}
        onOpenCustomer={onOpenRelatedCustomer}
        embedded
      />
    ) : (
      <p className="customer-detail-read__api-warn">연계 고객을 보려면 로그인이 필요합니다.</p>
    ),
    fireInsurance: (
      <CustomerFireInsuranceQuickSection
        customer={c}
        token={token}
        enabled={fetchCarsEnabled}
        embedded
      />
    ),
    business: (
      <CustomerBusinessQuickSection
        customer={c}
        token={token}
        onCustomerUpdated={onCustomerUpdated}
        embedded
      />
    ),
    alertDates: (
      <CustomerSpecialDatesQuickSection
        customer={c}
        token={token}
        enabled={fetchCarsEnabled}
        embedded
      />
    ),
  } satisfies Record<CustomerDetailCoreSectionId, ReactNode>

  return (
    <div className="customer-detail-read customer-detail-read--accordion">
      {CUSTOMER_DETAIL_CORE_SECTIONS.map((section) => (
        <CustomerDetailAccordionSection
          key={section.id}
          sectionId={section.id}
          title={section.title}
          testId={section.testId}
          expanded={openSections[section.id]}
          onExpandedChange={(expanded) => setSectionOpen(section.id, expanded)}
          sectionRef={(element) => {
            sectionRefs.current[section.id] = element
          }}
        >
          {sectionById[section.id]}
        </CustomerDetailAccordionSection>
      ))}
    </div>
  )
}

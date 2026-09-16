import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { CustomerRecord } from '../domain/types'
import {
  CUSTOMER_DETAIL_CORE_SECTIONS,
  type CustomerDetailCoreSectionId,
} from '../config/customerDetailCoreSectionOrder'
import { normalizeCustomerNotesBag } from '../domain/types'
import { CustomerBusinessQuickSection } from './detail-quick-crud/CustomerBusinessQuickSection'
import { CustomerCarsQuickSection } from './detail-quick-crud/CustomerCarsQuickSection'
import { CustomerFireInsuranceQuickSection } from './detail-quick-crud/CustomerFireInsuranceQuickSection'
import { CustomerSpecialDatesQuickSection } from './detail-quick-crud/CustomerSpecialDatesQuickSection'
import { CustomerBasicInfoSection } from './detail-quick-crud/CustomerBasicInfoQuickSection'
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
import {
  createDefaultCustomerDetailOpenSections,
  resetCustomerDetailOpenSectionsForCustomer,
  toggleCustomerDetailSectionOpen,
} from '../utils/customerDetailAccordionOpenState'

export type CustomerDetailInsuranceDisplay = {
  ageText: string
  dateText: string
  maturityYmd: string | null
  insuranceAgeNum: number | null
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
  onCustomerUpdated,
  crmIsInsuranceLayout,
  crmIndustryTemplate,
}: CustomerDetailReadViewProps) {
  const [openSections, setOpenSections] = useState(createDefaultCustomerDetailOpenSections)
  const [basicEditing, setBasicEditing] = useState(false)

  useEffect(() => {
    setOpenSections(resetCustomerDetailOpenSectionsForCustomer())
    setBasicEditing(false)
  }, [c.id])

  const setSectionOpen = useCallback((sectionId: CustomerDetailCoreSectionId, expanded: boolean) => {
    setOpenSections((previous) =>
      toggleCustomerDetailSectionOpen(previous, sectionId, expanded),
    )
  }, [])
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

  const sectionById = {
    basic: (
      <CustomerBasicInfoSection
        customer={c}
        ins={ins}
        token={token}
        fetchCarsEnabled={fetchCarsEnabled}
        onCustomerUpdated={onCustomerUpdated}
        onEditingChange={setBasicEditing}
      />
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
          title={section.id === 'basic' && basicEditing ? '기본 정보 수정 중' : section.title}
          testId={section.testId}
          expanded={openSections[section.id]}
          onExpandedChange={(expanded) => setSectionOpen(section.id, expanded)}
        >
          {sectionById[section.id]}
        </CustomerDetailAccordionSection>
      ))}
    </div>
  )
}

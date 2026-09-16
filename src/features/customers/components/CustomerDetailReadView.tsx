import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { CustomerRecord } from '../domain/types'
import {
  CUSTOMER_DETAIL_CORE_SECTIONS,
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
import { CustomerBasicInfoEditAction } from './detail-quick-crud/CustomerBasicInfoQuickSection'
import { CustomerCustomFieldsQuickInlineSection } from './detail-quick-crud/CustomerCustomFieldsQuickInlineSection'
import { CustomerDetailAccordionSection } from './CustomerDetailAccordionSection'
import { DetailReadFieldRow } from './DetailReadFieldRow'
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

  useEffect(() => {
    setOpenSections(resetCustomerDetailOpenSectionsForCustomer())
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

  const notes = normalizeCustomerNotesBag(c.notes)
  const inflowDetailMeta = getInflowSourceDetailFieldMeta(c.inflowSource)
  const inflowDetailName = c.referrerName?.trim()

  const sectionById = {
    basic: (
      <div className="customer-detail-read__field-list">
        <DetailReadFieldRow label="이름">{c.name || '—'}</DetailReadFieldRow>
        <DetailReadFieldRow label="연락처">{formatCustomerPhoneUi(c.phone) || '—'}</DetailReadFieldRow>
        <DetailReadFieldRow label="주민번호">{formatCustomerSsnUi(c.ssn) || '—'}</DetailReadFieldRow>
        <DetailReadFieldRow label="성별">
          {formatCustomerGenderReadLabel(c.gender, c.ssn)}
        </DetailReadFieldRow>
        <DetailReadFieldRow label="상령일">
          {ins.dateText}
          <MaturityDdayBadge maturityYmd={ins.maturityYmd} />
        </DetailReadFieldRow>
        <DetailReadFieldRow label="보험나이">{ins.ageText}</DetailReadFieldRow>
        <DetailReadFieldRow label="문자 수신">
          <CustomerSmsOptOutReadBadge smsOptOut={c.smsOptOut === true} />
        </DetailReadFieldRow>
        <DetailReadFieldRow label="통신사">
          {formatCustomerMobileCarrierDisplay(c.carrier) || '—'}
        </DetailReadFieldRow>
        <DetailReadFieldRow label="주소">{c.address || '—'}</DetailReadFieldRow>
        <DetailReadFieldRow label="키/몸무게">
          {c.height?.trim() || c.weight?.trim()
            ? `${c.height?.trim() || '—'}/${c.weight?.trim() || '—'}`
            : '—'}
        </DetailReadFieldRow>
        <DetailReadFieldRow label="직업/회사명/하는일/지역">{c.job?.trim() || '—'}</DetailReadFieldRow>
        <DetailReadFieldRow label="운전 여부">
          {c.isDriver === true
            ? '운전함'
            : c.isDriver === false
              ? '운전 안함'
              : c.driving || '—'}
        </DetailReadFieldRow>
        <DetailReadFieldRow label="유입 경로">
          {formatCustomerInflowSourceDisplay(c.inflowSource)}
        </DetailReadFieldRow>
        {inflowDetailMeta && inflowDetailName ? (
          <DetailReadFieldRow label={inflowDetailMeta.readLabel}>{inflowDetailName}</DetailReadFieldRow>
        ) : null}
        <CustomerMedicalHistoryReadSection {...resolveMedicalHistoryFromCustomer(c)} />
        <div className="customer-detail-read__subsection">
          <h5 className="customer-detail-read__subsection-title">보험 가입</h5>
          <div className="customer-insurance-history-body">
            {notes.insuranceHistory?.trim() ? notes.insuranceHistory : '내용 없음'}
          </div>
        </div>
        <div className="customer-detail-read__subsection">
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
        <CustomerCustomFieldsQuickInlineSection
          customer={c}
          token={token}
          enabled={fetchCarsEnabled}
        />
        <CustomerBasicInfoEditAction
          customer={c}
          token={token}
          onCustomerUpdated={onCustomerUpdated}
        />
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
        >
          {sectionById[section.id]}
        </CustomerDetailAccordionSection>
      ))}
    </div>
  )
}

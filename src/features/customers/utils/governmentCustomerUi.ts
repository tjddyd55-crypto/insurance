import { resolveCanonicalFieldKey } from '../../customer-templates'
import type { CustomerIndustryTemplate } from '../../customer-templates/customerTemplate.types'
import type { CustomerRecord } from '../domain/types'
import { readIndustryCanonDisplayValue } from './industryCustomerReadSummary'
import { formatIndustryCustomerListSecondaryLine } from './industryCustomerListSummary'

/** 정적 템플릿·동적 템플릿 모두 `meta.industryCode === 'government'` 로 수렴. */
export function isGovernmentIndustryTemplate(template: CustomerIndustryTemplate): boolean {
  return template.meta.industryCode === 'government'
}

/** 고객 카드 두 번째 줄: 운영에 바로 필요한 순서(comma 아님 middle dot 구분). */
const GOVERNMENT_CARD_SUMMARY_KEYS: readonly string[] = [
  'gov.status',
  'gov.programName',
  'gov.productName',
  'gov.caseNumber',
  'gov.submittedAt',
  'gov.assignee',
  'business.name',
]

/** 상세 상단 카드 전체 줄(항목 많음 · 빈 값은 — 표시로 운영 가시성 확보). */
const GOVERNMENT_DETAIL_SUMMARY_KEYS: readonly string[] = [
  'gov.programName',
  'gov.productName',
  'gov.applicationType',
  'gov.caseNumber',
  'gov.agency',
  'gov.department',
  'gov.status',
  'gov.submittedAt',
  'gov.dueDate',
  'gov.assignee',
  'gov.supportAmount',
  'gov.result',
  'gov.rejectionReason',
  'gov.supplementRequest',
  'business.name',
  'management.memoSummary',
  'management.lastConsultDate',
]

function labelForCanonKey(template: CustomerIndustryTemplate, canonicalKey: string): string {
  const f = template.formFields.find((x) => resolveCanonicalFieldKey(x.fieldKey) === canonicalKey)
  return f?.label?.trim() || canonicalKey
}

export function displayGovernmentCrValue(customer: CustomerRecord, canonicalKey: string): string {
  const raw = readIndustryCanonDisplayValue(customer, canonicalKey).trim()
  if (raw.length > 0) return raw
  return '—'
}

/** 목록 카드 메타 줄(정부 업종 한정). 빈 확장이라도 상태·상품 라인 노출 가능. */
export function formatGovernmentCardMetaSecondaryLine(
  customer: CustomerRecord,
  template: CustomerIndustryTemplate,
): string {
  const parts: string[] = []
  for (const k of GOVERNMENT_CARD_SUMMARY_KEYS) {
    const v = displayGovernmentCrValue(customer, k).trim()
    if (v === '—') continue
    parts.push(`${labelForCanonKey(template, k)}: ${v}`)
  }
  if (parts.length > 0) {
    return parts.join(' · ')
  }
  return formatIndustryCustomerListSecondaryLine(customer, template)
}

export type GovernmentOpsSummaryRow = { label: string; value: string; canonicalKey: string }

/** 상단 요약 카드 행 · 값 없어도 — 로 표시(미입력 상태 가시화). */
export function governmentDetailSummaryRows(
  customer: CustomerRecord,
  template: CustomerIndustryTemplate,
): GovernmentOpsSummaryRow[] {
  return GOVERNMENT_DETAIL_SUMMARY_KEYS.map((canonicalKey) => ({
    canonicalKey,
    label: labelForCanonKey(template, canonicalKey),
    value: displayGovernmentCrValue(customer, canonicalKey),
  }))
}

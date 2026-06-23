import {
  labelForCustomerPdfFieldKey,
} from '../config/customerPdfFieldOptions'
import type { PdfFieldDataMapping, PdfFieldSpec } from '../types'
import { normalizePdfFieldDataMapping } from './resolvePdfFieldValue'

export type PdfFieldDisplayNameInput = {
  /** 향후 dataGroup UI 확장용 — 현재는 useSecondaryCustomer 와 동치로 B 처리 */
  dataGroup?: 'A' | 'B' | null
  useSecondaryCustomer?: boolean
  fieldLabel: string
  fallbackLabel?: string
}

/** A/default 는 prefix 없음. B(useSecondaryCustomer) 만 `B-` 접두사. */
export function formatPdfFieldDisplayName(input: PdfFieldDisplayNameInput): string {
  const label = (input.fieldLabel || input.fallbackLabel || '').trim()
  if (!label) {
    return (input.fallbackLabel || '').trim()
  }
  const isB = input.dataGroup === 'B' || input.useSecondaryCustomer === true
  return isB ? `B-${label}` : label
}

export function customerMappingFieldLabel(mapping: PdfFieldDataMapping): string | null {
  const m = normalizePdfFieldDataMapping(mapping)
  if (m.dataSourceType !== 'customer' || !m.customerFieldKey) {
    return null
  }
  return (
    m.customerFieldLabel ||
    labelForCustomerPdfFieldKey(m.customerFieldKey) ||
    m.customerFieldKey
  )
}

/** 좌표 편집·목록·매핑 요약용 — 고객 매핑 라벨에 B 접두사 규칙 적용 */
export function formatPdfFieldMappingDisplayName(mapping: PdfFieldDataMapping): string {
  const m = normalizePdfFieldDataMapping(mapping)
  if (m.dataSourceType !== 'customer' || !m.customerFieldKey) {
    return '직접 입력'
  }
  const fieldLabel = customerMappingFieldLabel(m)
  if (!fieldLabel) {
    return '직접 입력'
  }
  return formatPdfFieldDisplayName({
    useSecondaryCustomer: m.useSecondaryCustomer,
    fieldLabel,
  })
}

/** PDF 좌표 chip 짧은 라벨 — 고객 매핑 text/textarea 는 매핑명, 그 외는 필드 라벨 */
export function formatPdfFieldChipLabel(
  field: Pick<PdfFieldSpec, 'label' | 'fieldType' | 'dataMapping'>,
): string {
  if (field.fieldType === 'text' || field.fieldType === 'textarea') {
    const mappingLabel = customerMappingFieldLabel(field.dataMapping)
    if (mappingLabel) {
      return formatPdfFieldMappingDisplayName(field.dataMapping)
    }
  }
  return field.label
}

/** chip title/tooltip — 필드명과 매핑명이 다를 때 전체 표시 */
export function formatPdfFieldChipTitle(
  field: Pick<PdfFieldSpec, 'label' | 'fieldType' | 'dataMapping'>,
): string {
  if (field.fieldType === 'text' || field.fieldType === 'textarea') {
    const mappingLabel = customerMappingFieldLabel(field.dataMapping)
    if (mappingLabel) {
      const short = formatPdfFieldMappingDisplayName(field.dataMapping)
      if (short !== field.label) {
        return `${field.label} · ${short}`
      }
    }
  }
  return field.label
}

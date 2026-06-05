import { isCustomerPdfCarFieldKey } from '../config/customerPdfFieldOptions'
import { normalizePdfFieldDataMapping } from './resolvePdfFieldValue'
import type { PdfFieldSpec } from '../types'

function isCarMappedInputField(f: PdfFieldSpec): boolean {
  const dm = normalizePdfFieldDataMapping(f.dataMapping)
  return (
    dm.dataSourceType === 'customer' &&
    !!dm.customerFieldKey &&
    isCustomerPdfCarFieldKey(dm.customerFieldKey) &&
    (f.fieldType === 'text' || f.fieldType === 'textarea')
  )
}

/** 템플릿 필드에 고객 차량 관련 customerFieldKey 매핑이 하나라도 있는지 */
export function hasCarMappedFields(fields: PdfFieldSpec[]): boolean {
  return fields.some(isCarMappedInputField)
}

/** 차량 적용 대상 텍스트 필드 수(안내 문구용) */
export function countCarMappedPdfInputFields(fields: PdfFieldSpec[]): number {
  return fields.filter(isCarMappedInputField).length
}

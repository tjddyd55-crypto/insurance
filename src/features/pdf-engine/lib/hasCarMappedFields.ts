import { isCustomerPdfCarFieldKey } from '../config/customerPdfFieldOptions'
import { readPdfFieldDataMappingFromField } from './resolvePdfFieldValue'
import type { PdfFieldSpec } from '../types'

/** API/DB 레거시 customerMapping 문자열까지 포함해 매핑 원본을 읽는다. */
export function resolvePdfFieldMappingRaw(field: PdfFieldSpec): ReturnType<typeof readPdfFieldDataMappingFromField> {
  return readPdfFieldDataMappingFromField(field as PdfFieldSpec & { customerMapping?: unknown })
}

function isCarMappedInputField(f: PdfFieldSpec): boolean {
  const dm = resolvePdfFieldMappingRaw(f)
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

/** dev 디버그·진단용 — PDF fieldKey:customerFieldKey 목록 */
export function listCarMappedPdfFieldKeys(fields: PdfFieldSpec[]): string[] {
  const out: string[] = []
  for (const f of fields) {
    if (!isCarMappedInputField(f)) continue
    const dm = resolvePdfFieldMappingRaw(f)
    out.push(`${f.fieldKey}:${dm.customerFieldKey ?? '?'}`)
  }
  return out
}

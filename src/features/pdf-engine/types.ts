/**
 * PDF 자동화 엔진 — 프론트 공용 타입.
 *
 * 서버측 `server/pdf-engine/schema/fieldSpec.js` 와 동일 형상.
 * 필드 타입을 추가할 때는 서버 스키마 + 여기 + DB CHECK 제약(initDb) 을 같이 수정한다.
 */

export const PDF_FIELD_TYPES = [
  'text',
  'textarea',
  'checkbox',
  'radio',
  'signature',
] as const
export type PdfFieldType = (typeof PDF_FIELD_TYPES)[number]

/** 관리자 좌표 에디터 드롭다운 표시용 — value 는 서버 fieldSpec 과 동일 */
export const PDF_FIELD_TYPE_LABELS: Record<PdfFieldType, string> = {
  text: '텍스트',
  textarea: '여러 줄 텍스트',
  checkbox: '체크박스',
  radio: '라디오',
  signature: '손사인',
}

export const PDF_CUSTOMER_MAPPINGS = ['name', 'dob', 'phone', 'address'] as const
export type PdfCustomerMapping = (typeof PDF_CUSTOMER_MAPPINGS)[number]

export interface PdfPlacement {
  /** 0-based 페이지 인덱스. */
  page: number
  /** PDF 포인트(원점 좌하단). */
  x: number
  y: number
  /** 텍스트 박스 너비. 있으면 줄바꿈/정렬 기준이 된다. */
  width: number | null
  /** 텍스트 박스 높이. textarea 에서 라인 초과 방지. */
  height: number | null
  /** 텍스트 크기(pt). null 이면 서버 기본값(11pt). */
  fontSize: number | null
  align: 'left' | 'center' | 'right'
  /**
   * radio 필드 전용 — 이 placement 가 대표하는 옵션 값.
   * 렌더 시 선택된 값과 일치하는 placement 만 체크 마크가 그려진다.
   * 다른 타입에서는 항상 null.
   */
  optionValue: string | null
}

export interface PdfFieldSpec {
  fieldKey: string
  label: string
  fieldType: PdfFieldType
  required: boolean
  orderIndex: number
  customerMapping: PdfCustomerMapping | null
  /**
   * checkbox/radio 타입의 선택지(사용자에게 보이는 세부 라벨).
   * 다른 타입은 null.
   * UI 에서 옵션을 추가/삭제/재정렬할 수 있다.
   */
  options: string[] | null
  placements: PdfPlacement[]
}

export interface PdfTemplateSummary {
  id: number
  gaId: number | null
  gaName: string | null
  gaCode: string | null
  code: string
  title: string
  description: string
  pageCount: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PdfTemplateDetail {
  template: PdfTemplateSummary
  fields: (PdfFieldSpec & { id: number })[]
}

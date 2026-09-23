import { CUSTOMER_DESIGNATED_DATE_LABEL } from '../../../../shared/customerDesignatedDateCopy.js'

/** PC 고객 상세 핵심 정보 섹션 SSOT. 지정일 표기는 알림 대시보드 카드와 같다. */
export type CustomerDetailCoreSectionId =
  | 'basic'
  | 'vehicle'
  | 'linked'
  | 'fireInsurance'
  | 'business'
  | 'alertDates'

export const CUSTOMER_DETAIL_CORE_SECTIONS: readonly {
  id: CustomerDetailCoreSectionId
  title: string
  testId: string
}[] = [
  { id: 'basic', title: '기본 정보', testId: 'customer-detail-section-basic' },
  { id: 'vehicle', title: '자동차 정보', testId: 'customer-detail-section-vehicle' },
  { id: 'linked', title: '연계 고객', testId: 'customer-detail-section-linked-customers' },
  { id: 'fireInsurance', title: '화재보험 정보', testId: 'customer-detail-section-fire-insurance' },
  { id: 'business', title: '사업자 정보', testId: 'customer-detail-section-business' },
  { id: 'alertDates', title: CUSTOMER_DESIGNATED_DATE_LABEL, testId: 'customer-detail-section-special-dates' },
]

export const CUSTOMER_DETAIL_DEFAULT_OPEN_SECTION: CustomerDetailCoreSectionId = 'basic'

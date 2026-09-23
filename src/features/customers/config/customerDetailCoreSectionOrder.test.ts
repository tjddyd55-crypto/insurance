import { describe, expect, it } from 'vitest'

import {
  CUSTOMER_DETAIL_CORE_SECTIONS,
  CUSTOMER_DETAIL_DEFAULT_OPEN_SECTION,
} from './customerDetailCoreSectionOrder'

describe('customerDetailCoreSectionOrder', () => {
  it('keeps core section order and uses the notification dashboard label for designated dates', () => {
    expect(CUSTOMER_DETAIL_CORE_SECTIONS.map((section) => section.title)).toEqual([
      '기본 정보',
      '자동차 정보',
      '연계 고객',
      '화재보험 정보',
      '사업자 정보',
      '지정일',
    ])
    expect(CUSTOMER_DETAIL_DEFAULT_OPEN_SECTION).toBe('basic')
  })
})

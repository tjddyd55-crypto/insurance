import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CUSTOMER_DETAIL_CORE_SECTIONS } from '../../config/customerDetailCoreSectionOrder'
import { CustomerCarsQuickSection } from './CustomerCarsQuickSection'
import { CustomerFireInsuranceQuickSection } from './CustomerFireInsuranceQuickSection'
import { CustomerBusinessQuickSection } from './CustomerBusinessQuickSection'
import { CustomerSpecialDatesQuickSection } from './CustomerSpecialDatesQuickSection'

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..')
const indexCss = readFileSync(join(srcRoot, 'index.css'), 'utf8')
const specialDatesSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'CustomerSpecialDatesQuickSection.tsx'),
  'utf8',
)

const baseCustomer = {
  id: 1,
  name: '홍길동',
  ssn: '',
  phone: '',
  carrier: '',
  address: '',
  height: '',
  weight: '',
  job: '',
  medical: '',
  gender: null,
  isDriver: null,
  carType: '',
  carNumber: '',
  carModel: '',
  carYear: '',
  renewalDate: '',
  notes: { items: [] },
  isFavorite: false,
  smsOptOut: false,
  inflowSource: null,
  referrerName: null,
  businessInfo: null,
} as const

describe('CustomerDetailQuickCrud sections', () => {
  it('keeps six core accordion section ids without extra sections', () => {
    expect(CUSTOMER_DETAIL_CORE_SECTIONS.map((section) => section.id)).toEqual([
      'basic',
      'vehicle',
      'linked',
      'fireInsurance',
      'business',
      'alertDates',
    ])
  })

  it('renders car quick add button and AppDateInput modal fields', () => {
    const html = renderToStaticMarkup(
      <CustomerCarsQuickSection customer={baseCustomer} token="tok" enabled={false} embedded />,
    )
    expect(html).toContain('+ 자동차 추가')
    expect(html).toContain('등록된 자동차 정보가 없습니다.')
  })

  it('renders fire quick add button', () => {
    const html = renderToStaticMarkup(
      <CustomerFireInsuranceQuickSection customer={baseCustomer} token="tok" enabled={false} embedded />,
    )
    expect(html).toContain('+ 소재지 추가')
    expect(html).toContain('등록된 화재보험 소재지가 없습니다.')
  })

  it('renders business quick register button', () => {
    const html = renderToStaticMarkup(
      <CustomerBusinessQuickSection customer={baseCustomer} token="tok" embedded />,
    )
    expect(html).toContain('+ 사업자 정보 등록')
  })

  it('renders special date quick add button', () => {
    const html = renderToStaticMarkup(
      <CustomerSpecialDatesQuickSection customer={baseCustomer} token="tok" enabled={false} embedded />,
    )
    expect(html).toContain('+ 알림일 추가')
    expect(html).toContain('등록된 알림일이 없습니다.')
    expect(html).not.toContain('customer-quick-crud-card__fields--inline')
  })

  it('lays designated dates out as a horizontal name and date row', () => {
    expect(specialDatesSource).toContain('customer-special-date-row__title')
    expect(specialDatesSource).toContain('customer-special-date-row__date')
    expect(specialDatesSource).not.toContain('customer-quick-crud-card__fields--inline')
    expect(indexCss).not.toContain('customer-quick-crud-card__fields--inline')
    expect(indexCss).toMatch(/\.customer-special-date-row\s*\{[^}]*flex-wrap:\s*nowrap/s)
    expect(indexCss).toMatch(/\.customer-special-date-row__date\s*\{[^}]*white-space:\s*nowrap/s)
    expect(indexCss).toMatch(/\.customer-special-date-row__title\s*\{[^}]*word-break:\s*keep-all/s)
  })
})

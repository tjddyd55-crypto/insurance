import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

describe('고객등록/수정 폼 버튼 SSOT wiring', () => {
  const cars = read('features/customers/components/CustomerCarsEditor.tsx')
  const special = read('features/customers/components/CustomerSpecialDatesEditor.tsx')
  const account = read('features/customers/components/CustomerAccountNumberField.tsx')
  const form = read('components/customer/CustomerForm.tsx')
  const industry = read('features/customers/components/CustomerIndustryTemplateFields.tsx')
  const address = read('components/form/AddressSearchField.tsx')
  const indexCss = read('index.css')

  it('자동차 추가는 FormButton secondary sm 이며 filter-button 을 쓰지 않는다', () => {
    expect(cars).toMatch(/자동차 추가/)
    expect(cars).toMatch(/variant="secondary"/)
    expect(cars).toMatch(/size="sm"/)
    expect(cars).not.toMatch(/filter-button/)
  })

  it('기념일 추가는 자동차 추가와 동일 variant/size', () => {
    expect(special).toMatch(/기념일 추가/)
    expect(special).toMatch(/variant="secondary"/)
    expect(special).toMatch(/size="sm"/)
    expect(special).not.toMatch(/filter-button/)
  })

  it('계좌번호 복사는 FormButton secondary sm', () => {
    expect(account).toMatch(/variant="secondary"/)
    expect(account).toMatch(/size="sm"/)
  })

  it('메모 추가(등록 폼)는 FormButton secondary sm, filter-button/inline style 금지', () => {
    const memoBlock = form.match(/pushDraftNoteFixed\(form\.noteDraft\)[\s\S]{0,250}?추가/)
    expect(memoBlock?.[0]).toContain('variant="secondary"')
    expect(memoBlock?.[0]).toContain('size="sm"')
    expect(memoBlock?.[0]).not.toContain('filter-button')
    expect(memoBlock?.[0]).not.toContain('style={{')
  })

  it('저장은 FormButton primary fullWidth (로직/class 중복 없이)', () => {
    expect(form).toMatch(
      /<FormButton htmlType="submit" variant="primary" fullWidth>\s*저장\s*<\/FormButton>/,
    )
  })

  it('주소 검색은 FormButton secondary fullWidth', () => {
    const search = address.match(/searchButtonLabel[\s\S]{0,200}?FormButton[\s\S]{0,250}?searchButtonLabel/)
    expect(address).toContain('variant="secondary"')
    expect(address).toContain('fullWidth')
    expect(search?.[0] ?? address).toContain('openDialog')
  })

  it('업종 템플릿 메모 추가도 secondary sm', () => {
    expect(industry).toMatch(/variant="secondary"[\s\S]{0,80}?size="sm"[\s\S]{0,120}?추가/)
    expect(industry).not.toMatch(/className="filter-button"/)
  })

  it('모바일 customers-page button 리셋은 .button(FormButton) 을 제외한다', () => {
    expect(indexCss).toContain(
      '.customers-page--mobile button:not(.button):not(.customer-detail-action-button)',
    )
  })
})

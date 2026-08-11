import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const mobileLayoutSource = readFileSync(join(dir, 'CustomerWorkspaceLayoutMobile.tsx'), 'utf8')
const customersPageSource = readFileSync(join(dir, '../CustomersPage.tsx'), 'utf8')

describe('CustomerWorkspaceLayoutMobile — 모바일 최근등록 자동 갱신', () => {
  it('CUSTOMERS_LIST_REFRESH_EVENT 를 import 한다', () => {
    expect(mobileLayoutSource).toMatch(/CUSTOMERS_LIST_REFRESH_EVENT/)
  })

  it('window.addEventListener 로 CUSTOMERS_LIST_REFRESH_EVENT 를 구독한다', () => {
    expect(mobileLayoutSource).toContain('window.addEventListener(CUSTOMERS_LIST_REFRESH_EVENT')
  })

  it('window.removeEventListener 로 cleanup 한다', () => {
    expect(mobileLayoutSource).toContain('window.removeEventListener(CUSTOMERS_LIST_REFRESH_EVENT')
  })

  it('이벤트 핸들러에서 loadRecentCustomers 를 호출한다', () => {
    expect(mobileLayoutSource).toMatch(/CUSTOMERS_LIST_REFRESH_EVENT[\s\S]{0,250}loadRecentCustomers/)
  })

  it('모달 오픈 시 항상 loadRecentCustomers 를 호출한다 (stale local state 방지)', () => {
    // 기존: length === 0 일 때만 fetch → 기존 목록이 있으면 신규 고객이 안 보임
    expect(mobileLayoutSource).not.toMatch(
      /setRecentOpen\(true\)[\s\S]{0,120}sortedRecentCustomers\.length === 0/,
    )
    const openBlock = mobileLayoutSource.match(
      /setRecentOpen\(true\)[\s\S]{0,200}?최근 등록/,
    )
    expect(openBlock).not.toBeNull()
    expect(openBlock?.[0]).toContain('loadRecentCustomers')
  })

  it('수동 새로고침 버튼이 loadRecentCustomers 를 호출한다', () => {
    expect(mobileLayoutSource).toMatch(/onClick=\{\(\) => void loadRecentCustomers\(\)\}/)
  })
})

describe('모바일 직접등록 → 최근등록 SSOT wiring', () => {
  it('CustomersPage 직접등록 성공이 dispatchCustomersListRefresh 를 호출한다', () => {
    const saveSuccessBlock = customersPageSource.match(
      /onInternalSaveSuccess[\s\S]{0,400}?navigateToCustomerListReplace/,
    )
    expect(saveSuccessBlock).not.toBeNull()
    expect(saveSuccessBlock?.[0]).toContain('dispatchCustomersListRefresh')
  })

  it('모바일 최근등록 UI 는 CustomerWorkspaceHomePage 가 아니라 LayoutMobile 이다', () => {
    // HomePage 이벤트만 구독하면 모바일 증상이 재발한다.
    expect(mobileLayoutSource).toContain('customer-recent-mobile-trigger')
    expect(mobileLayoutSource).toContain('customer-recent-mobile-modal')
  })
})

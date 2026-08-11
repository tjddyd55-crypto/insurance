import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const homePageSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'CustomerWorkspaceHomePage.tsx'),
  'utf8',
)

const customersPageSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'CustomersPage.tsx'),
  'utf8',
)

describe('CustomerWorkspaceHomePage — 최근등록 자동 갱신', () => {
  it('CUSTOMERS_LIST_REFRESH_EVENT 를 import 한다', () => {
    expect(homePageSource).toMatch(/CUSTOMERS_LIST_REFRESH_EVENT/)
  })

  it('window.addEventListener 로 CUSTOMERS_LIST_REFRESH_EVENT 를 구독한다', () => {
    expect(homePageSource).toContain('window.addEventListener(CUSTOMERS_LIST_REFRESH_EVENT')
  })

  it('window.removeEventListener 로 이벤트를 정리한다 (cleanup 보장)', () => {
    expect(homePageSource).toContain('window.removeEventListener(CUSTOMERS_LIST_REFRESH_EVENT')
  })

  it('이벤트 핸들러 안에서 loadRecentCustomers 를 호출한다', () => {
    // 이벤트 handler 가 loadRecentCustomers 를 참조해야 최근등록이 갱신된다.
    expect(homePageSource).toMatch(/CUSTOMERS_LIST_REFRESH_EVENT[\s\S]{0,200}loadRecentCustomers/)
  })
})

describe('CustomersPage — 직접 고객등록 성공 후 최근등록 dispatch', () => {
  it('dispatchCustomersListRefresh 를 import 한다', () => {
    expect(customersPageSource).toMatch(/dispatchCustomersListRefresh/)
  })

  it('onInternalSaveSuccess 콜백 안에서 dispatchCustomersListRefresh 를 호출한다', () => {
    // 등록 성공 → dispatch → CustomerWorkspaceHomePage 의 이벤트 핸들러 트리거 순서를 보장.
    const saveSuccessBlock = customersPageSource.match(
      /onInternalSaveSuccess[\s\S]{0,400}?navigateToCustomerListReplace/,
    )
    expect(saveSuccessBlock).not.toBeNull()
    expect(saveSuccessBlock?.[0]).toContain('dispatchCustomersListRefresh')
  })
})

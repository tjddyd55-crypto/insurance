/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardPaymentContractRow } from '../api/premiumPaymentsApi'
import PremiumPaymentsOverviewPage from './PremiumPaymentsOverviewPage'

const contract: CardPaymentContractRow = {
  id: 1,
  customerId: 1,
  customerName: '테스트 고객',
  customerSsn: '0000000000000',
  paymentCardId: null,
  insuranceCompany: '테스트 보험사',
  policyNumber: 'TEST-POLICY',
  productName: null,
  premiumAmount: null,
  paymentDay: null,
  memo: '',
  status: 'PENDING',
  monthStatus: 'PENDING',
  targetMonth: '2026-01',
  lastCompletedAt: null,
  monthCompletedAt: null,
  card: null,
}

vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ token: 'test-token' }) }))
vi.mock('../../insurer-sites/api/insurerSitesApi', () => ({
  fetchActiveInsurerSites: async () => ({ items: [] }),
}))
vi.mock('../api/premiumPaymentsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/premiumPaymentsApi')>(),
  listPaymentCards: async () => [],
  listCardPaymentContracts: async (_token: string, _customerId: number, targetMonth: string) => ({
    contracts: [contract],
    targetMonth,
  }),
  listCardPaymentContractsOverview: async () => ({
    contracts: [contract, { ...contract, id: 2, customerId: 2, customerName: '번호 없는 고객', customerSsn: '' }],
  }),
}))

describe('card receipt clipboard feedback', () => {
  let host: HTMLDivElement
  let root: Root
  const writeText = vi.fn()

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.useFakeTimers()
    writeText.mockReset().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    await act(async () => {
      root.render(<MemoryRouter><PremiumPaymentsOverviewPage /></MemoryRouter>)
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    Reflect.deleteProperty(navigator, 'clipboard')
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function button(text: string) {
    const match = Array.from(host.querySelectorAll('button')).find((entry) => entry.textContent === text)
    if (!match) throw new Error(`Missing button: ${text}`)
    return match
  }

  async function click(element: HTMLButtonElement | null) {
    if (!element) throw new Error('Missing copy button')
    await act(async () => element.click())
  }

  it('copies from the PC insurer header and table, including when the customer search has no match', async () => {
    const search = host.querySelector<HTMLInputElement>('input[placeholder="고객명 또는 연락처 검색"]')
    if (!search) throw new Error('Missing customer search')
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    await act(async () => {
      setValue?.call(search, 'no match')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(host.textContent).toContain('왼쪽에서 고객을 선택해 주세요.')
    await click(button('보험사별'))

    const headers = host.querySelectorAll('[data-testid="card-insurer-customer-rrn"]')
    expect(headers).toHaveLength(2)
    expect(Array.from(headers).filter((header) => header.querySelector('button'))).toHaveLength(1)
    await click(host.querySelector('button[aria-label="주민번호 복사"]'))
    expect(writeText).toHaveBeenLastCalledWith('000000-0000000')
    const firstToast = document.body.querySelector('.premium-payments-copy-toast[role="status"]')
    expect(firstToast?.textContent).toBe('복사되었습니다')
    expect(firstToast?.parentElement).toBe(document.body)

    act(() => vi.advanceTimersByTime(1000))
    await click(host.querySelector('td button.premium-payments-inline-value__copy'))
    expect(writeText).toHaveBeenLastCalledWith('TEST-POLICY')
    act(() => vi.advanceTimersByTime(500))
    expect(document.querySelector('.premium-payments-copy-toast')?.textContent).toBe('복사되었습니다')
    act(() => vi.advanceTimersByTime(1000))
    expect(document.querySelector('.premium-payments-copy-toast')).toBeNull()
  })

  it('uses the clipboard fallback when the async API is unavailable', async () => {
    Reflect.deleteProperty(navigator, 'clipboard')
    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })
    try {
      await click(button('복사'))
      expect(execCommand).toHaveBeenCalledWith('copy')
      expect(document.querySelector('.premium-payments-copy-toast')?.textContent).toBe('복사되었습니다')
    } finally {
      Reflect.deleteProperty(document, 'execCommand')
    }
  })

  it('shows an overlay when customer-view policy copying fails', async () => {
    expect(host.querySelector('button[aria-label="주민번호 복사"]')).toBeNull()
    writeText.mockRejectedValueOnce(new Error('Clipboard unavailable'))
    await click(button('복사'))
    expect(writeText).toHaveBeenCalledWith('TEST-POLICY')
    expect(document.querySelector('.premium-payments-copy-toast')?.textContent).toBe('복사에 실패했습니다')
    expect(host.querySelector('.premium-payments-copy-toast')).toBeNull()
  })
})

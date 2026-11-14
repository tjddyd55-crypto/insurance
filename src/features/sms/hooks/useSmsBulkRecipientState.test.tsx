// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSmsBulkRecipientState, type SmsBulkRecipientState } from './useSmsBulkRecipientState'
import type { SmsBulkSearchCustomer } from '../types/smsBulkRecipient.types'
import SmsBulkRecipientWorkspace from '../components/bulk/SmsBulkRecipientWorkspace'
import SmsBulkGroupsPanel from '../components/bulk/SmsBulkGroupsPanel'
import * as groupApi from '../api/smsRecipientGroupsApi'
import { searchSmsBulkRecipients } from '../api/smsBulkRecipientsApi'

vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ token: 'test-only' }) }))
vi.mock('../api/smsBulkRecipientsApi', () => ({ searchSmsBulkRecipients: vi.fn() }))
vi.mock('../api/smsRecipientGroupsApi', () => ({
  fetchSmsRecipientGroupMembers: vi.fn(),
  fetchSmsRecipientGroups: vi.fn(),
  createSmsRecipientGroup: vi.fn(),
  updateSmsRecipientGroup: vi.fn(),
  deleteSmsRecipientGroup: vi.fn(),
}))

const customer = (id: number): SmsBulkSearchCustomer => ({
  customerId: id,
  name: `고객 ${id}`,
  gender: 'male',
  genderLabel: '남자',
  birthDate: null,
  phone: `0101234567${id}`,
  phoneDisplay: `0101234567${id}`,
  insuranceAge: 40,
  sangnyeongDday: null,
  sangnyeongLabel: '-',
  canSend: true,
  blockedReason: null,
})
let root: ReturnType<typeof createRoot> | undefined
let host: HTMLDivElement | undefined
afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  host?.remove()
  vi.clearAllMocks()
})

async function mountState(renderPanel: false | 'pc' | 'mobile' | 'workspace' = false) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  let state: SmsBulkRecipientState
  function Harness() {
    const current = useSmsBulkRecipientState()
    useEffect(() => {
      state = current
    })
    return renderPanel === 'workspace' ? <SmsBulkRecipientWorkspace variant="pc" groupsOnly bulkState={current} /> : renderPanel ? <SmsBulkGroupsPanel bulkState={current} layout={renderPanel} /> : null
  }
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root?.render(<Harness />))
  return () => state
}

describe('group cart isolation', () => {
  it.each(['group-first', 'search-first'])(
    'loads, merges and removes without mutating saved groups (%s)',
    async (order) => {
      const members = [customer(1), customer(2)]
      vi.mocked(groupApi.fetchSmsRecipientGroupMembers).mockResolvedValue({
        customers: members,
      } as Awaited<ReturnType<typeof groupApi.fetchSmsRecipientGroupMembers>>)
      vi.mocked(searchSmsBulkRecipients).mockResolvedValue({
        customers: [customer(2), customer(3)],
        totalCount: 2,
      })
      const state = await mountState()
      const addSearch = async () => {
        await act(async () => {
          await state().runSearch()
        })
        await act(async () => state().selectAllSearchResults())
        await act(async () => state().addSelectedToRecipients())
      }
      if (order === 'group-first') {
        await act(async () => {
          await state().replaceCartWithGroup(10)
        })
        await addSearch()
      } else {
        await addSearch()
        await act(async () => {
          await state().appendGroupToCart(10)
        })
      }
      expect([...state().sendableCustomerIds].sort()).toEqual([1, 2, 3])
      await act(async () => state().toggleCartCustomer(2))
      await act(async () => state().removeSelectedRecipients())
      await act(async () => state().resetFilters())
      expect([...state().sendableCustomerIds].sort()).toEqual([1, 3])
      expect(members.map((row) => row.customerId)).toEqual([1, 2])
      expect(groupApi.updateSmsRecipientGroup).not.toHaveBeenCalled()
      expect(groupApi.createSmsRecipientGroup).not.toHaveBeenCalled()
      expect(groupApi.deleteSmsRecipientGroup).not.toHaveBeenCalled()
      vi.mocked(groupApi.fetchSmsRecipientGroups).mockResolvedValue([])
      await act(async () => {
        await state().saveGroupFromCart({ name: '새 그룹', description: '' })
      })
      expect([...state().sendableCustomerIds].sort()).toEqual([1, 3])
      expect(groupApi.createSmsRecipientGroup).toHaveBeenCalledWith(
        'test-only',
        expect.objectContaining({ customerIds: expect.arrayContaining([1, 3]) }),
      )
    },
  )
})

describe('latest selected group and cart sources', () => {
  const members = { 10: [customer(1), customer(2)], 20: [customer(2), customer(3)] }
  async function setup(renderPanel: false | 'pc' | 'mobile' | 'workspace' = false) {
    vi.mocked(groupApi.fetchSmsRecipientGroups).mockResolvedValue([
      { id: 10, name: 'A', description: '' },
      { id: 20, name: 'B', description: '' },
    ] as Awaited<ReturnType<typeof groupApi.fetchSmsRecipientGroups>>)
    vi.mocked(groupApi.fetchSmsRecipientGroupMembers).mockImplementation(async (_, id) => ({
      customers: members[id as keyof typeof members],
      customerIds: members[id as keyof typeof members].map((row) => row.customerId),
    }))
    const state = await mountState(renderPanel)
    await act(async () => { await state().reloadGroups() })
    return state
  }
  function expectNoMutation() {
    expect(groupApi.updateSmsRecipientGroup).not.toHaveBeenCalled()
    expect(groupApi.deleteSmsRecipientGroup).not.toHaveBeenCalled()
    expect(groupApi.createSmsRecipientGroup).not.toHaveBeenCalled()
    expect(members[10].map((row) => row.customerId)).toEqual([1, 2])
    expect(members[20].map((row) => row.customerId)).toEqual([2, 3])
  }
  it.each(['pc', 'mobile'] as const)('name/card select only; explicit append and confirmed replace follow the latest group (%s)', async (layout) => {
    const state = await setup(layout)
    const click = async (element: Element | null) => {
      expect(element).not.toBeNull()
      await act(async () => { (element as HTMLElement).click() })
    }
    const button = (text: string) => [...host!.querySelectorAll('button')].find((node) => node.textContent?.trim() === text) ?? null
    const activeName = () => host!.querySelector('.sms-bulk-group-row--active .sms-bulk-group-row__name')?.textContent
    await click(host!.querySelector('[aria-label="A 선택"]'))
    expect(activeName()).toBe('A')
    expect(state().selectedGroupId).toBe(10)
    expect(state().groupMembers.map((row) => row.customerId)).toEqual([1, 2])
    expect(state().sendableCustomerIds).toEqual([])
    await click(host!.querySelectorAll('.sms-bulk-group-row')[1])
    expect(activeName()).toBe('B')
    expect(state().selectedGroupId).toBe(20)
    expect(host!.querySelector('.sms-bulk-groups__detail h3')?.textContent).toBe('B')
    expect(state().groupMembers.map((row) => row.customerId)).toEqual([2, 3])
    expect(state().sendableCustomerIds).toEqual([])
    expect(state().loadedGroupNames).toEqual([])
    expect(host!.querySelector('.sms-bulk-group-row__last')?.textContent).not.toContain('불러오기')
    await click(host!.querySelector('[aria-label="A 선택"]'))
    await click(button('추가로 불러오기'))
    expect(activeName()).toBe('A')
    expect(state().sendableCustomerIds).toEqual([1, 2])
    expect(state().loadedGroupNames).toEqual(['A'])
    expect(state().actionNotice).toContain('2명이 추가')
    await click(host!.querySelector('[aria-label="B 선택"]'))
    await click(button('추가로 불러오기'))
    expect(activeName()).toBe('B')
    expect(state().sendableCustomerIds).toEqual([1, 2, 3])
    expect(state().loadedGroupNames).toEqual(['A', 'B'])
    expect(state().actionNotice).toContain('1명이 추가')
    expect(state().actionNotice).toContain('이미 추가된 고객 1명')
    await click(button('그룹 관리'))
    await click(button('A 관리'))
    await click(button('불러오기로 돌아가기'))
    expect(activeName()).toBe('A')
    expect(state().sendableCustomerIds).toEqual([1, 2, 3])
    await click(host!.querySelector('[aria-label="B 선택"]'))
    expect(activeName()).toBe('B')
    expect(state().sendableCustomerIds).toEqual([1, 2, 3])
    await click(host!.querySelectorAll('.sms-bulk-group-row')[0])
    expect(activeName()).toBe('A')
    expect(state().sendableCustomerIds).toEqual([1, 2, 3])
    expect(state().loadedGroupNames).toEqual(['A', 'B'])
    await click(host!.querySelector('[aria-label="B 선택"]'))
    await click(button('교체해서 불러오기'))
    expect(state().sendableCustomerIds).toEqual([1, 2, 3])
    // The in-app confirmation must complete before replacing the cart or selection.
    expect(activeName()).toBe('B')
    await click([...document.querySelectorAll('button')].find((node) => node.textContent?.trim() === '교체') ?? null)
    expect(activeName()).toBe('B')
    expect(state().sendableCustomerIds).toEqual([2, 3])
    expect(state().loadedGroupNames).toEqual(['B'])
    await act(async () => state().clearRecipients())
    await click(button('교체해서 불러오기'))
    // Empty carts load immediately without a confirmation.
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(activeName()).toBe('B')
    expect(state().sendableCustomerIds).toEqual([2, 3])
    expect(state().loadedGroupNames).toEqual(['B'])
    expectNoMutation()
  })
  it.each(['추가로 불러오기', '교체해서 불러오기'])('opens load modal and closes after %s succeeds', async (loadLabel) => {
    const state = await setup('workspace')
    const clickText = async (text: string) => {
      const target = [...document.querySelectorAll('button')].find((node) => node.textContent?.trim() === text)
      expect(target).toBeTruthy()
      await act(async () => target!.click())
    }
    expect(document.querySelector('.sms-bulk-group-row')).toBeNull()
    await clickText('저장된 그룹 불러오기')
    expect(document.querySelector('[role="dialog"][aria-label="저장된 그룹 불러오기"]')).toBeTruthy()
    await act(async () => (document.querySelector('[aria-label="A 선택"]') as HTMLButtonElement).click())
    await clickText(loadLabel)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(state().sendableCustomerIds).toEqual([1, 2])
    expect(host!.textContent).toContain('불러온 그룹: A')
    expect(host!.querySelector('.sms-bulk-workspace__notice')).toBeNull()
    expect(document.querySelector('[role="status"]')?.textContent).toContain('발송 대상을 불러왔습니다')
    expectNoMutation()
  })
  it('keeps the load modal open on failure and preserves cart on replacement cancellation', async () => {
    const state = await setup('workspace')
    const clickText = async (text: string) => {
      const target = [...document.querySelectorAll('button')].find((node) => node.textContent?.trim() === text)
      expect(target).toBeTruthy()
      await act(async () => target!.click())
    }
    await act(async () => { await state().appendGroupToCart(10) })
    await clickText('저장된 그룹 불러오기')
    await act(async () => (document.querySelector('[aria-label="B 선택"]') as HTMLButtonElement).click())
    await clickText('교체해서 불러오기')
    await clickText('취소')
    expect(state().sendableCustomerIds).toEqual([1, 2])
    expect(document.querySelector('[aria-label="저장된 그룹 불러오기"]')).toBeTruthy()
    vi.mocked(groupApi.fetchSmsRecipientGroupMembers).mockRejectedValueOnce(new Error('불러오기 오류'))
    await clickText('추가로 불러오기')
    expect(document.querySelector('[aria-label="저장된 그룹 불러오기"]')).toBeTruthy()
    expect(document.querySelector('[role="status"]')?.textContent).toBe('불러오기 오류')
    expect(state().sendableCustomerIds).toEqual([1, 2])
    expectNoMutation()
  })
  it('saves the cart through the simplified form and leaves recipients in place', async () => {
    const state = await setup('workspace')
    await act(async () => { await state().appendGroupToCart(10) })
    const saveButton = [...host!.querySelectorAll('button')].find((node) => node.textContent === '이 대상을 그룹으로 저장')!
    await act(async () => saveButton.click())
    const dialog = document.querySelector('[aria-label="새 그룹 저장"]')!
    expect(dialog.textContent).toContain('구성원 2명')
    const input = dialog.querySelector('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '테스트 그룹')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => [...dialog.querySelectorAll('button')].find((node) => node.textContent === '저장')!.click())
    expect(groupApi.createSmsRecipientGroup).toHaveBeenCalledWith('test-only', { name: '테스트 그룹', description: '', customerIds: [1, 2] })
    expect(document.querySelector('[aria-label="새 그룹 저장"]')).toBeNull()
    expect(state().sendableCustomerIds).toEqual([1, 2])
    expect(document.querySelector('[role="status"]')?.textContent).toBe('그룹을 저장했습니다.')
  })
  it('selects A then B without changing the cart', async () => {
    const state = await setup()
    await act(async () => { await state().selectGroup(10) })
    await act(async () => { await state().selectGroup(20) })
    expect(state().selectedGroupId).toBe(20)
    expect(state().groupMembers.map((row) => row.customerId)).toEqual([2, 3])
    expect(state().selectedRecipients).toEqual([])
    expectNoMutation()
  })
  it.each(['replaceCartWithGroup', 'appendGroupToCart'] as const)('%s follows A→B without mutating groups', async (action) => {
    const state = await setup()
    await act(async () => { await state()[action](10) })
    await act(async () => { await state()[action](20) })
    expect(state().selectedGroupId).toBe(20)
    expect(state().groupMembers.map((row) => row.customerId)).toEqual([2, 3])
    expect(state().sendableCustomerIds).toEqual(action === 'replaceCartWithGroup' ? [2, 3] : [1, 2, 3])
    expect(state().loadedGroupNames).toEqual(action === 'replaceCartWithGroup' ? ['B'] : ['A', 'B'])
    expectNoMutation()
    await act(async () => state().clearRecipients())
    expect(state().loadedGroupNames).toEqual([])
  })
  it('prunes sources on removal and preserves them when mixing searched customers', async () => {
    const state = await setup()
    await act(async () => { await state().appendGroupToCart(10) })
    vi.mocked(searchSmsBulkRecipients).mockResolvedValue({ customers: [customer(3)], totalCount: 1 })
    await act(async () => { await state().runSearch() })
    await act(async () => state().selectAllSearchResults())
    await act(async () => state().addSelectedToRecipients())
    expect(state().loadedGroupNames).toEqual(['A'])
    await act(async () => state().removeRecipient(1))
    expect(state().loadedGroupNames).toEqual(['A'])
    await act(async () => state().removeRecipient(2))
    expect(state().loadedGroupNames).toEqual([])
    await act(async () => state().removeRecipient(3))
    expect(state().loadedGroupNames).toEqual([])
    expectNoMutation()
  })
  it.each(['selectGroup', 'replaceCartWithGroup', 'appendGroupToCart'] as const)('%s ignores late A members after B is selected', async (action) => {
    const state = await setup()
    await act(async () => { await state().selectGroup(10) })
    let resolveA!: (value: Awaited<ReturnType<typeof groupApi.fetchSmsRecipientGroupMembers>>) => void
    vi.mocked(groupApi.fetchSmsRecipientGroupMembers).mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve }))
    let pendingA!: Promise<unknown>
    await act(async () => { pendingA = state()[action](10) })
    let pendingB!: Promise<unknown>
    let resolveB!: typeof resolveA
    vi.mocked(groupApi.fetchSmsRecipientGroupMembers).mockImplementationOnce(() => new Promise((resolve) => { resolveB = resolve }))
    await act(async () => { pendingB = state()[action](20) })
    expect(state().selectedGroupId).toBe(20)
    expect(state().groupMembers).toEqual([])
    await act(async () => {
      resolveB({ customers: members[20], customerIds: [2, 3] })
      await pendingB
    })
    await act(async () => {
      resolveA({ customers: members[10], customerIds: [1, 2] })
      await pendingA
    })
    expect(state().selectedGroupId).toBe(20)
    expect(state().groupMembers.map((row) => row.customerId)).toEqual([2, 3])
    if (action !== 'selectGroup') {
      expect(state().sendableCustomerIds).toEqual([2, 3])
      expect(state().loadedGroupNames).toEqual(['B'])
    }
    expectNoMutation()
  })
})

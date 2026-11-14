// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSmsBulkRecipientState, type SmsBulkRecipientState } from './useSmsBulkRecipientState'
import type { SmsBulkSearchCustomer } from '../types/smsBulkRecipient.types'
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

async function mountState(renderPanel = false) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  let state: SmsBulkRecipientState
  function Harness() {
    const current = useSmsBulkRecipientState()
    useEffect(() => {
      state = current
    })
    return renderPanel ? <SmsBulkGroupsPanel bulkState={current} layout="pc" /> : null
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
  async function setup(renderPanel = false) {
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
  it('name, card, management and confirmed replacement follow the latest group', async () => {
    const state = await setup(true)
    const click = async (element: Element | null) => {
      expect(element).not.toBeNull()
      await act(async () => { (element as HTMLElement).click() })
    }
    const button = (text: string) => [...host!.querySelectorAll('button')].find((node) => node.textContent?.trim() === text) ?? null
    const activeName = () => host!.querySelector('.sms-bulk-group-row--active .sms-bulk-group-row__name')?.textContent
    await click(host!.querySelector('[aria-label="A 추가로 불러오기"]'))
    expect(activeName()).toBe('A')
    await click(host!.querySelectorAll('.sms-bulk-group-row')[1])
    expect(activeName()).toBe('B')
    expect(state().sendableCustomerIds).toEqual([1, 2, 3])
    await click(button('A 관리'))
    expect(activeName()).toBe('A')
    expect(state().sendableCustomerIds).toEqual([1, 2, 3])
    await click(host!.querySelector('[aria-label="B 추가로 불러오기"]'))
    expect(activeName()).toBe('B')
    expect(host!.querySelector('.sms-bulk-groups__detail h3')?.textContent).toBe('B')
    expect(state().groupMembers.map((row) => row.customerId)).toEqual([2, 3])
    await click(host!.querySelectorAll('.sms-bulk-group-row')[0].querySelectorAll('button')[1])
    // The in-app confirmation must complete before replacing the cart or selection.
    expect(activeName()).toBe('B')
    await click([...document.querySelectorAll('button')].find((node) => node.textContent?.trim() === '교체') ?? null)
    expect(activeName()).toBe('A')
    expect(state().sendableCustomerIds).toEqual([1, 2])
    expect(state().loadedGroupNames).toEqual(['A'])
    expectNoMutation()
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

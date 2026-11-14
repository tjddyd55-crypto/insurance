// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSmsBulkRecipientState, type SmsBulkRecipientState } from './useSmsBulkRecipientState'
import type { SmsBulkSearchCustomer } from '../types/smsBulkRecipient.types'
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

async function mountState() {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  let state: SmsBulkRecipientState
  function Harness() {
    const current = useSmsBulkRecipientState()
    useEffect(() => {
      state = current
    })
    return null
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

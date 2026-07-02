import { useCallback, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { searchSmsBulkRecipients } from '../api/smsBulkRecipientsApi'
import {
  createSmsRecipientGroup,
  deleteSmsRecipientGroup,
  fetchSmsRecipientGroupMembers,
  fetchSmsRecipientGroups,
  updateSmsRecipientGroup,
} from '../api/smsRecipientGroupsApi'
import {
  EMPTY_SMS_BULK_FILTERS,
  type SmsBulkRecipientFilters,
  type SmsBulkSearchCustomer,
  type SmsRecipientGroupSummary,
  type SmsSelectedRecipient,
} from '../types/smsBulkRecipient.types'
import {
  buildAddResultMessage,
  buildCartAppendToGroupMessage,
  buildGroupAppendToCartMessage,
  summarizeSelectedRecipients,
} from '../utils/smsRecipientEligibility'
import { mergeCustomerIdsForGroup, mergeSmsRecipientSelections } from '../utils/smsRecipientSelection'

export type SmsBulkRecipientViewFilter = 'all' | 'sendable' | 'excluded'
export type SmsBulkMobileTab = 'search' | 'selected' | 'groups'

export function useSmsBulkRecipientState() {
  const { token } = useAuth()
  const [filters, setFilters] = useState<SmsBulkRecipientFilters>({ ...EMPTY_SMS_BULK_FILTERS })
  const [searchResults, setSearchResults] = useState<SmsBulkSearchCustomer[]>([])
  const [searchTotalCount, setSearchTotalCount] = useState(0)
  const [selectedSearchIds, setSelectedSearchIds] = useState<Set<number>>(() => new Set())
  const [selectedRecipients, setSelectedRecipients] = useState<SmsSelectedRecipient[]>([])
  const [recipientViewFilter, setRecipientViewFilter] = useState<SmsBulkRecipientViewFilter>('all')
  const [mobileTab, setMobileTab] = useState<SmsBulkMobileTab>('search')
  const [groups, setGroups] = useState<SmsRecipientGroupSummary[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [groupMembers, setGroupMembers] = useState<SmsBulkSearchCustomer[]>([])
  const [groupSearchQuery, setGroupSearchQuery] = useState('')
  const [searchBusy, setSearchBusy] = useState(false)
  const [groupActionBusy, setGroupActionBusy] = useState(false)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [groupSaveModalOpen, setGroupSaveModalOpen] = useState(false)
  const [newGroupModalOpen, setNewGroupModalOpen] = useState(false)
  const [groupEditModalOpen, setGroupEditModalOpen] = useState(false)

  const summary = useMemo(() => summarizeSelectedRecipients(selectedRecipients), [selectedRecipients])

  const visibleRecipients = useMemo(() => {
    if (recipientViewFilter === 'sendable') {
      return selectedRecipients.filter((r) => r.canSend)
    }
    if (recipientViewFilter === 'excluded') {
      return selectedRecipients.filter((r) => !r.canSend)
    }
    return selectedRecipients
  }, [recipientViewFilter, selectedRecipients])

  const sendableCustomerIds = useMemo(
    () => selectedRecipients.filter((r) => r.canSend).map((r) => r.customerId),
    [selectedRecipients],
  )

  const filteredGroups = useMemo(() => {
    const q = groupSearchQuery.trim().toLowerCase()
    if (!q) {
      return groups
    }
    return groups.filter(
      (group) =>
        group.name.toLowerCase().includes(q) ||
        group.description.toLowerCase().includes(q),
    )
  }, [groupSearchQuery, groups])

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  )

  const runSearch = useCallback(async () => {
    if (!token?.trim()) {
      return
    }
    setSearchBusy(true)
    setActionNotice(null)
    try {
      const result = await searchSmsBulkRecipients(token, filters)
      setSearchResults(result.customers)
      setSearchTotalCount(result.totalCount)
      setSelectedSearchIds(new Set())
    } finally {
      setSearchBusy(false)
    }
  }, [filters, token])

  const toggleSearchCustomer = useCallback((customerId: number) => {
    setSelectedSearchIds((prev) => {
      const next = new Set(prev)
      if (next.has(customerId)) {
        next.delete(customerId)
      } else {
        next.add(customerId)
      }
      return next
    })
  }, [])

  const selectAllSearchResults = useCallback(() => {
    setSelectedSearchIds(new Set(searchResults.map((row) => row.customerId)))
  }, [searchResults])

  const clearSearchSelection = useCallback(() => {
    setSelectedSearchIds(new Set())
  }, [])

  const addSelectedToRecipients = useCallback(() => {
    const incoming = searchResults.filter((row) => selectedSearchIds.has(row.customerId))
    const { recipients, result } = mergeSmsRecipientSelections(selectedRecipients, incoming)
    setSelectedRecipients(recipients)
    setSelectedSearchIds(new Set())
    setActionNotice(buildAddResultMessage(result.addedCount, result.skipped))
    setMobileTab('selected')
  }, [searchResults, selectedRecipients, selectedSearchIds])

  const removeRecipient = useCallback((customerId: number) => {
    setSelectedRecipients((prev) => prev.filter((row) => row.customerId !== customerId))
  }, [])

  const clearRecipients = useCallback(() => {
    setSelectedRecipients([])
    setActionNotice(null)
  }, [])

  const reloadGroups = useCallback(async () => {
    if (!token?.trim()) {
      return
    }
    const rows = await fetchSmsRecipientGroups(token)
    setGroups(rows)
    if (selectedGroupId != null && !rows.some((row) => row.id === selectedGroupId)) {
      setSelectedGroupId(null)
      setGroupMembers([])
    }
  }, [selectedGroupId, token])

  const loadGroupMembers = useCallback(
    async (groupId: number) => {
      if (!token?.trim()) {
        return
      }
      setGroupActionBusy(true)
      try {
        const data = await fetchSmsRecipientGroupMembers(token, groupId)
        setGroupMembers(data.customers)
      } finally {
        setGroupActionBusy(false)
      }
    },
    [token],
  )

  const selectGroup = useCallback(
    async (groupId: number) => {
      setSelectedGroupId(groupId)
      await loadGroupMembers(groupId)
    },
    [loadGroupMembers],
  )

  const saveGroupFromCart = useCallback(
    async (input: { name: string; description: string }) => {
      if (!token?.trim()) {
        return
      }
      setGroupActionBusy(true)
      try {
        await createSmsRecipientGroup(token, {
          name: input.name,
          description: input.description,
          customerIds: selectedRecipients.map((r) => r.customerId),
        })
        setGroupSaveModalOpen(false)
        setActionNotice('그룹을 저장했습니다.')
        await reloadGroups()
      } finally {
        setGroupActionBusy(false)
      }
    },
    [reloadGroups, selectedRecipients, token],
  )

  const createGroup = useCallback(
    async (input: { name: string; description: string; mode: 'empty' | 'from_cart' }) => {
      if (!token?.trim()) {
        return
      }
      setGroupActionBusy(true)
      try {
        const customerIds =
          input.mode === 'from_cart' ? selectedRecipients.map((r) => r.customerId) : []
        const created = await createSmsRecipientGroup(token, {
          name: input.name,
          description: input.description,
          customerIds,
        })
        setNewGroupModalOpen(false)
        setActionNotice(
          input.mode === 'from_cart'
            ? `그룹 "${created.name}"을(를) 현재 선택 대상 ${customerIds.length}명으로 만들었습니다.`
            : `빈 그룹 "${created.name}"을(를) 만들었습니다.`,
        )
        await reloadGroups()
        await selectGroup(created.id)
        setMobileTab('groups')
      } finally {
        setGroupActionBusy(false)
      }
    },
    [reloadGroups, selectGroup, selectedRecipients, token],
  )

  const appendGroupToCart = useCallback(
    async (groupId: number) => {
      if (!token?.trim()) {
        return
      }
      setGroupActionBusy(true)
      try {
        const data = await fetchSmsRecipientGroupMembers(token, groupId)
        const { recipients, result } = mergeSmsRecipientSelections(selectedRecipients, data.customers)
        setSelectedRecipients(recipients)
        setActionNotice(
          buildGroupAppendToCartMessage(data.customers.length, result.addedCount, result.skipped),
        )
        setMobileTab('selected')
      } finally {
        setGroupActionBusy(false)
      }
    },
    [selectedRecipients, token],
  )

  const replaceCartWithGroup = useCallback(
    async (groupId: number) => {
      if (!token?.trim()) {
        return false
      }
      setGroupActionBusy(true)
      try {
        const data = await fetchSmsRecipientGroupMembers(token, groupId)
        setSelectedRecipients(data.customers)
        setActionNotice(`그룹 고객 ${data.customers.length}명으로 장바구니를 교체했습니다.`)
        setMobileTab('selected')
        return true
      } finally {
        setGroupActionBusy(false)
      }
    },
    [token],
  )

  const appendCartToGroup = useCallback(
    async (groupId: number) => {
      if (!token?.trim()) {
        return
      }
      setGroupActionBusy(true)
      try {
        const data = await fetchSmsRecipientGroupMembers(token, groupId)
        const cartIds = selectedRecipients.map((r) => r.customerId)
        const { mergedIds, addedCount, alreadyInGroup } = mergeCustomerIdsForGroup(data.customerIds, cartIds)
        await updateSmsRecipientGroup(token, groupId, { customerIds: mergedIds })
        setActionNotice(buildCartAppendToGroupMessage(cartIds.length, addedCount, alreadyInGroup))
        await reloadGroups()
        await loadGroupMembers(groupId)
      } finally {
        setGroupActionBusy(false)
      }
    },
    [loadGroupMembers, reloadGroups, selectedRecipients, token],
  )

  const replaceGroupWithCart = useCallback(
    async (groupId: number) => {
      if (!token?.trim()) {
        return false
      }
      setGroupActionBusy(true)
      try {
        const customerIds = selectedRecipients.map((r) => r.customerId)
        await updateSmsRecipientGroup(token, groupId, { customerIds })
        setActionNotice(`그룹 구성원을 현재 선택 대상 ${customerIds.length}명으로 교체했습니다.`)
        await reloadGroups()
        await loadGroupMembers(groupId)
        return true
      } finally {
        setGroupActionBusy(false)
      }
    },
    [loadGroupMembers, reloadGroups, selectedRecipients, token],
  )

  const updateGroupMeta = useCallback(
    async (groupId: number, input: { name: string; description: string }) => {
      if (!token?.trim()) {
        return
      }
      setGroupActionBusy(true)
      try {
        await updateSmsRecipientGroup(token, groupId, {
          name: input.name,
          description: input.description,
        })
        setGroupEditModalOpen(false)
        setActionNotice('그룹 정보를 수정했습니다.')
        await reloadGroups()
      } finally {
        setGroupActionBusy(false)
      }
    },
    [reloadGroups, token],
  )

  const removeGroupMember = useCallback(
    async (groupId: number, customerId: number) => {
      if (!token?.trim()) {
        return
      }
      setGroupActionBusy(true)
      try {
        const nextIds = groupMembers
          .map((row) => row.customerId)
          .filter((id) => id !== customerId)
        await updateSmsRecipientGroup(token, groupId, { customerIds: nextIds })
        setActionNotice('그룹 구성원을 제거했습니다.')
        await reloadGroups()
        await loadGroupMembers(groupId)
      } finally {
        setGroupActionBusy(false)
      }
    },
    [groupMembers, loadGroupMembers, reloadGroups, token],
  )

  const removeGroup = useCallback(
    async (groupId: number) => {
      if (!token?.trim()) {
        return false
      }
      setGroupActionBusy(true)
      try {
        await deleteSmsRecipientGroup(token, groupId)
        if (selectedGroupId === groupId) {
          setSelectedGroupId(null)
          setGroupMembers([])
        }
        setActionNotice('그룹을 삭제했습니다.')
        await reloadGroups()
        return true
      } finally {
        setGroupActionBusy(false)
      }
    },
    [reloadGroups, selectedGroupId, token],
  )

  return {
    filters,
    setFilters,
    searchResults,
    searchTotalCount,
    selectedSearchIds,
    selectedRecipients,
    visibleRecipients,
    recipientViewFilter,
    setRecipientViewFilter,
    mobileTab,
    setMobileTab,
    groups,
    filteredGroups,
    selectedGroupId,
    selectedGroup,
    groupMembers,
    groupSearchQuery,
    setGroupSearchQuery,
    searchBusy,
    groupActionBusy,
    actionNotice,
    setActionNotice,
    groupSaveModalOpen,
    setGroupSaveModalOpen,
    newGroupModalOpen,
    setNewGroupModalOpen,
    groupEditModalOpen,
    setGroupEditModalOpen,
    summary,
    sendableCustomerIds,
    runSearch,
    toggleSearchCustomer,
    selectAllSearchResults,
    clearSearchSelection,
    addSelectedToRecipients,
    removeRecipient,
    clearRecipients,
    reloadGroups,
    selectGroup,
    saveGroupFromCart,
    createGroup,
    appendGroupToCart,
    replaceCartWithGroup,
    appendCartToGroup,
    replaceGroupWithCart,
    updateGroupMeta,
    removeGroupMember,
    removeGroup,
  }
}

export type SmsBulkRecipientState = ReturnType<typeof useSmsBulkRecipientState>

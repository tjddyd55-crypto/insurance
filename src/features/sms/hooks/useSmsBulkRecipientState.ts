import { useCallback, useEffect, useMemo, useState } from 'react'
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
  const [selectedCartIds, setSelectedCartIds] = useState<Set<number>>(() => new Set())
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(() => new Set())
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<Set<number>>(() => new Set())
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

  useEffect(() => {
    const valid = new Set(selectedRecipients.map((row) => row.customerId))
    setSelectedCartIds((prev) => {
      let changed = false
      const next = new Set<number>()
      for (const id of prev) {
        if (valid.has(id)) {
          next.add(id)
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [selectedRecipients])

  useEffect(() => {
    const valid = new Set(groups.map((group) => group.id))
    setSelectedGroupIds((prev) => {
      let changed = false
      const next = new Set<number>()
      for (const id of prev) {
        if (valid.has(id)) {
          next.add(id)
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [groups])

  useEffect(() => {
    const valid = new Set(groupMembers.map((row) => row.customerId))
    setSelectedGroupMemberIds((prev) => {
      let changed = false
      const next = new Set<number>()
      for (const id of prev) {
        if (valid.has(id)) {
          next.add(id)
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [groupMembers])

  const runSearch = useCallback(async (overrideFilters?: SmsBulkRecipientFilters) => {
    if (!token?.trim()) {
      return
    }
    const activeFilters = overrideFilters ?? filters
    setSearchBusy(true)
    setActionNotice(null)
    try {
      const result = await searchSmsBulkRecipients(token, activeFilters)
      setSearchResults(result.customers)
      setSearchTotalCount(result.totalCount)
      setSelectedSearchIds(new Set())
    } finally {
      setSearchBusy(false)
    }
  }, [filters, token])

  const resetFilters = useCallback(async () => {
    const defaults = { ...EMPTY_SMS_BULK_FILTERS }
    setFilters(defaults)
    setSelectedSearchIds(new Set())
    await runSearch(defaults)
  }, [runSearch])

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

  const toggleCartCustomer = useCallback((customerId: number) => {
    setSelectedCartIds((prev) => {
      const next = new Set(prev)
      if (next.has(customerId)) {
        next.delete(customerId)
      } else {
        next.add(customerId)
      }
      return next
    })
  }, [])

  const selectAllVisibleCart = useCallback(() => {
    setSelectedCartIds(new Set(visibleRecipients.map((row) => row.customerId)))
  }, [visibleRecipients])

  const clearCartSelection = useCallback(() => {
    setSelectedCartIds(new Set())
  }, [])

  const removeSelectedRecipients = useCallback(() => {
    const removeCount = selectedCartIds.size
    if (removeCount === 0) {
      return
    }
    setSelectedRecipients((prev) => prev.filter((row) => !selectedCartIds.has(row.customerId)))
    setSelectedCartIds(new Set())
    setActionNotice(`${removeCount}명을 선택 대상에서 제거했습니다.`)
  }, [selectedCartIds])

  const removeRecipient = useCallback((customerId: number) => {
    setSelectedRecipients((prev) => prev.filter((row) => row.customerId !== customerId))
    setSelectedCartIds((prev) => {
      if (!prev.has(customerId)) {
        return prev
      }
      const next = new Set(prev)
      next.delete(customerId)
      return next
    })
  }, [])

  const clearRecipients = useCallback(() => {
    setSelectedRecipients([])
    setSelectedCartIds(new Set())
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

  const toggleGroupSelection = useCallback((groupId: number) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }, [])

  const selectAllFilteredGroups = useCallback(() => {
    setSelectedGroupIds(new Set(filteredGroups.map((group) => group.id)))
  }, [filteredGroups])

  const clearGroupSelection = useCallback(() => {
    setSelectedGroupIds(new Set())
  }, [])

  const removeSelectedGroups = useCallback(async () => {
    if (!token?.trim() || selectedGroupIds.size === 0) {
      return false
    }
    const ids = Array.from(selectedGroupIds)
    setGroupActionBusy(true)
    try {
      for (const groupId of ids) {
        await deleteSmsRecipientGroup(token, groupId)
      }
      if (selectedGroupId != null && ids.includes(selectedGroupId)) {
        setSelectedGroupId(null)
        setGroupMembers([])
        setSelectedGroupMemberIds(new Set())
      }
      setSelectedGroupIds(new Set())
      setActionNotice(`${ids.length}개 그룹을 삭제했습니다.`)
      await reloadGroups()
      return true
    } finally {
      setGroupActionBusy(false)
    }
  }, [reloadGroups, selectedGroupId, selectedGroupIds, token])

  const toggleGroupMemberSelection = useCallback((customerId: number) => {
    setSelectedGroupMemberIds((prev) => {
      const next = new Set(prev)
      if (next.has(customerId)) {
        next.delete(customerId)
      } else {
        next.add(customerId)
      }
      return next
    })
  }, [])

  const selectAllGroupMembers = useCallback(() => {
    setSelectedGroupMemberIds(new Set(groupMembers.map((row) => row.customerId)))
  }, [groupMembers])

  const clearGroupMemberSelection = useCallback(() => {
    setSelectedGroupMemberIds(new Set())
  }, [])

  const removeSelectedGroupMembers = useCallback(
    async (groupId: number) => {
      if (!token?.trim() || selectedGroupMemberIds.size === 0) {
        return false
      }
      const removeCount = selectedGroupMemberIds.size
      setGroupActionBusy(true)
      try {
        const nextIds = groupMembers
          .filter((row) => !selectedGroupMemberIds.has(row.customerId))
          .map((row) => row.customerId)
        await updateSmsRecipientGroup(token, groupId, { customerIds: nextIds })
        setSelectedGroupMemberIds(new Set())
        setActionNotice(`${removeCount}명을 그룹에서 제거했습니다.`)
        await reloadGroups()
        await loadGroupMembers(groupId)
        return true
      } finally {
        setGroupActionBusy(false)
      }
    },
    [groupMembers, loadGroupMembers, reloadGroups, selectedGroupMemberIds, token],
  )

  const selectGroup = useCallback(
    async (groupId: number) => {
      setSelectedGroupId(groupId)
      setSelectedGroupMemberIds(new Set())
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
    selectedCartIds,
    selectedGroupIds,
    selectedGroupMemberIds,
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
    resetFilters,
    toggleSearchCustomer,
    selectAllSearchResults,
    clearSearchSelection,
    addSelectedToRecipients,
    toggleCartCustomer,
    selectAllVisibleCart,
    clearCartSelection,
    removeSelectedRecipients,
    removeRecipient,
    clearRecipients,
    toggleGroupSelection,
    selectAllFilteredGroups,
    clearGroupSelection,
    removeSelectedGroups,
    toggleGroupMemberSelection,
    selectAllGroupMembers,
    clearGroupMemberSelection,
    removeSelectedGroupMembers,
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

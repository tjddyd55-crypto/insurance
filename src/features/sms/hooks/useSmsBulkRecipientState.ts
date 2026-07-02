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
import { buildAddResultMessage, summarizeSelectedRecipients } from '../utils/smsRecipientEligibility'
import { mergeSmsRecipientSelections } from '../utils/smsRecipientSelection'

export type SmsBulkRecipientViewFilter = 'all' | 'sendable' | 'excluded'

export function useSmsBulkRecipientState() {
  const { token } = useAuth()
  const [filters, setFilters] = useState<SmsBulkRecipientFilters>({ ...EMPTY_SMS_BULK_FILTERS })
  const [searchResults, setSearchResults] = useState<SmsBulkSearchCustomer[]>([])
  const [searchTotalCount, setSearchTotalCount] = useState(0)
  const [selectedSearchIds, setSelectedSearchIds] = useState<Set<number>>(() => new Set())
  const [selectedRecipients, setSelectedRecipients] = useState<SmsSelectedRecipient[]>([])
  const [recipientViewFilter, setRecipientViewFilter] = useState<SmsBulkRecipientViewFilter>('all')
  const [mobileTab, setMobileTab] = useState<'search' | 'selected'>('search')
  const [groups, setGroups] = useState<SmsRecipientGroupSummary[]>([])
  const [searchBusy, setSearchBusy] = useState(false)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [groupPickerOpen, setGroupPickerOpen] = useState(false)

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
  }, [token])

  const saveGroup = useCallback(
    async (input: { name: string; description: string }) => {
      if (!token?.trim()) {
        return
      }
      await createSmsRecipientGroup(token, {
        name: input.name,
        description: input.description,
        customerIds: selectedRecipients.map((r) => r.customerId),
      })
      setGroupModalOpen(false)
      setActionNotice('그룹을 저장했습니다.')
      await reloadGroups()
    },
    [reloadGroups, selectedRecipients, token],
  )

  const loadGroup = useCallback(
    async (groupId: number) => {
      if (!token?.trim()) {
        return
      }
      const data = await fetchSmsRecipientGroupMembers(token, groupId)
      const { recipients, result } = mergeSmsRecipientSelections(selectedRecipients, data.customers)
      setSelectedRecipients(recipients)
      setGroupPickerOpen(false)
      setActionNotice(`그룹을 불러왔습니다. ${buildAddResultMessage(result.addedCount, result.skipped)}`)
      setMobileTab('selected')
    },
    [selectedRecipients, token],
  )

  const renameGroup = useCallback(
    async (groupId: number, name: string) => {
      if (!token?.trim()) {
        return
      }
      await updateSmsRecipientGroup(token, groupId, { name })
      setActionNotice('그룹 이름을 변경했습니다.')
      await reloadGroups()
    },
    [reloadGroups, token],
  )

  const removeGroup = useCallback(
    async (groupId: number) => {
      if (!token?.trim()) {
        return
      }
      await deleteSmsRecipientGroup(token, groupId)
      setActionNotice('그룹을 삭제했습니다.')
      await reloadGroups()
    },
    [reloadGroups, token],
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
    searchBusy,
    actionNotice,
    setActionNotice,
    groupModalOpen,
    setGroupModalOpen,
    groupPickerOpen,
    setGroupPickerOpen,
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
    saveGroup,
    loadGroup,
    renameGroup,
    removeGroup,
  }
}

export type SmsBulkRecipientState = ReturnType<typeof useSmsBulkRecipientState>

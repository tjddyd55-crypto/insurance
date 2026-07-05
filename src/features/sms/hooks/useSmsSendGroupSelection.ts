import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchSmsRecipientGroupMembers } from '../api/smsRecipientGroupsApi'
import type { SmsBulkSearchCustomer, SmsRecipientGroupSummary } from '../types/smsBulkRecipient.types'
import {
  buildSmsSendCustomerIdsText,
  buildSmsSendGroupSummary,
  resolveSmsSendGroupFetchDecision,
  type SmsSendGroupSummary,
} from '../utils/smsSendGroupSelection'

type Params = {
  token: string | null | undefined
  groups: SmsRecipientGroupSummary[]
  onCustomerIdsTextChange: (customerIdsText: string) => void
}

export function useSmsSendGroupSelection({ token, groups, onCustomerIdsTextChange }: Params) {
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [groupSummary, setGroupSummary] = useState<SmsSendGroupSummary | null>(null)
  const [isLoadingGroupMembers, setIsLoadingGroupMembers] = useState(false)
  const groupMembersRequestRef = useRef(0)
  const groupMembersCacheRef = useRef(new Map<string, SmsBulkSearchCustomer[]>())
  const onCustomerIdsTextChangeRef = useRef(onCustomerIdsTextChange)

  onCustomerIdsTextChangeRef.current = onCustomerIdsTextChange

  const selectedGroup = useMemo(
    () => groups.find((group) => String(group.id) === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  )

  const applyGroupMembers = useCallback((customers: SmsBulkSearchCustomer[]) => {
    setGroupSummary(buildSmsSendGroupSummary(customers))
    onCustomerIdsTextChangeRef.current(buildSmsSendCustomerIdsText(customers))
  }, [])

  const clearGroupSelectionState = useCallback(() => {
    setGroupSummary(null)
    onCustomerIdsTextChangeRef.current('')
  }, [])

  const handleGroupChange = useCallback((groupId: string) => {
    setSelectedGroupId(groupId)
  }, [])

  useEffect(() => {
    const decision = resolveSmsSendGroupFetchDecision(selectedGroupId, groupMembersCacheRef.current)

    if (decision === 'skip-empty') {
      clearGroupSelectionState()
      return
    }

    if (decision === 'use-cache') {
      applyGroupMembers(groupMembersCacheRef.current.get(selectedGroupId) ?? [])
      return
    }

    if (!token?.trim()) {
      clearGroupSelectionState()
      return
    }

    const requestId = ++groupMembersRequestRef.current
    let cancelled = false

    const load = async () => {
      setIsLoadingGroupMembers(true)
      try {
        const data = await fetchSmsRecipientGroupMembers(token, Number(selectedGroupId))
        if (cancelled || requestId !== groupMembersRequestRef.current) {
          return
        }
        groupMembersCacheRef.current.set(selectedGroupId, data.customers)
        applyGroupMembers(data.customers)
      } catch {
        if (cancelled || requestId !== groupMembersRequestRef.current) {
          return
        }
        clearGroupSelectionState()
      } finally {
        if (!cancelled && requestId === groupMembersRequestRef.current) {
          setIsLoadingGroupMembers(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [applyGroupMembers, clearGroupSelectionState, selectedGroupId, token])

  return {
    selectedGroupId,
    setSelectedGroupId,
    selectedGroup,
    groupSummary,
    isLoadingGroupMembers,
    handleGroupChange,
  }
}

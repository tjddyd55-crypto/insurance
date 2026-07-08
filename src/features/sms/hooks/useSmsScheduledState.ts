import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useConfirmDialog } from '../../../components/dialog'
import {
  createSmsScheduledMessage,
  deleteSmsScheduledMessage,
  fetchSmsScheduledMessages,
  type SmsScheduledMessageDto,
} from '../api/smsScheduledApi'
import { fetchSmsRecipientGroupMembers, fetchSmsRecipientGroups } from '../api/smsRecipientGroupsApi'
import { SMS_SCHEDULE_DEFAULT_SEND_TIME } from '../config/smsScheduled.config'
import type { SmsBulkSearchCustomer, SmsRecipientGroupSummary } from '../types/smsBulkRecipient.types'
import type { SmsTemplate } from '../types/sms.types'
import {
  EMPTY_SMS_SCHEDULED_FORM,
  type SmsScheduledFormState,
  type SmsScheduledListFilter,
  type SmsScheduledMobilePanel,
  type SmsScheduledRule,
  type SmsScheduledRuleStatus,
  type SmsScheduledRunHistoryItem,
} from '../types/smsScheduled.types'
import {
  computeNextRunAtPreview,
  formatNextRunAtLabel,
} from '../utils/smsScheduledSummary'
import { isSmsScheduledSaveValid, validateSmsScheduledSave } from '../utils/smsScheduledValidation'
import { formatSmsBlockedReason, summarizeSelectedRecipients } from '../utils/smsRecipientEligibility'

function mapServerStatus(status: SmsScheduledMessageDto['status']): SmsScheduledRuleStatus {
  if (status === 'active' || status === 'processing') {
    return 'active'
  }
  if (status === 'paused') {
    return 'paused'
  }
  if (status === 'failed') {
    return 'failed'
  }
  return 'inactive'
}

function dtoToRule(dto: SmsScheduledMessageDto): SmsScheduledRule {
  const uiStatus = mapServerStatus(dto.status)
  return {
    id: String(dto.id),
    name: dto.name,
    description: dto.description || undefined,
    enabled: uiStatus === 'active',
    scheduleType: dto.scheduleType,
    sendDate: dto.sendDate ?? undefined,
    sendTime: dto.sendTime || SMS_SCHEDULE_DEFAULT_SEND_TIME,
    weekdays: dto.weekdays?.length ? dto.weekdays : undefined,
    monthDay: dto.monthDay ?? undefined,
    recipientGroupId: String(dto.recipientGroupId),
    templateId: dto.templateId != null ? String(dto.templateId) : undefined,
    messageBody: dto.messageBody,
    messageType: dto.messageType,
    nextRunAt: dto.nextRunAt,
    lastRunAt: dto.lastRunAt,
    status: uiStatus,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    serverStatus: dto.status,
    lastErrorCode: dto.lastErrorCode,
    lastErrorMessage: dto.lastErrorMessage,
  }
}

function ruleToForm(rule: SmsScheduledRule): SmsScheduledFormState {
  return {
    name: rule.name,
    description: rule.description ?? '',
    enabled: rule.enabled,
    scheduleType: rule.scheduleType,
    sendDate: rule.sendDate ?? '',
    sendTime: rule.sendTime || SMS_SCHEDULE_DEFAULT_SEND_TIME,
    weekdays: rule.weekdays ?? [],
    monthDay: rule.monthDay ?? 10,
    recipientGroupId: rule.recipientGroupId,
    templateId: rule.templateId ?? '',
    messageBody: rule.messageBody,
    messageType: rule.messageType,
  }
}

function matchesListFilter(rule: SmsScheduledRule, filter: SmsScheduledListFilter): boolean {
  if (filter === 'all') {
    return true
  }
  if (filter === 'active') {
    return rule.enabled && rule.status === 'active'
  }
  if (filter === 'inactive') {
    return !rule.enabled || rule.status === 'inactive' || rule.status === 'paused'
  }
  return rule.status === 'failed'
}

export function useSmsScheduledState(templates: SmsTemplate[]) {
  const { token, user } = useAuth()
  const { confirm, confirmDialog } = useConfirmDialog()
  const userKey = user?.id ? String(user.id) : ''

  const [rules, setRules] = useState<SmsScheduledRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [rulesError, setRulesError] = useState<string | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [groups, setGroups] = useState<SmsRecipientGroupSummary[]>([])
  const [groupMembers, setGroupMembers] = useState<SmsBulkSearchCustomer[]>([])
  const [membersBusy, setMembersBusy] = useState(false)
  const [listFilter, setListFilter] = useState<SmsScheduledListFilter>('all')
  const [listSearch, setListSearch] = useState('')
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState<SmsScheduledFormState>({ ...EMPTY_SMS_SCHEDULED_FORM })
  const [mobilePanel, setMobilePanel] = useState<SmsScheduledMobilePanel>('list')
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0)

  const reloadRules = useCallback(async () => {
    if (!token?.trim()) {
      setRules([])
      return
    }
    setRulesLoading(true)
    setRulesError(null)
    try {
      const rows = await fetchSmsScheduledMessages(token)
      setRules(rows.map(dtoToRule))
    } catch (err) {
      setRules([])
      setRulesError(err instanceof Error ? err.message : '예약 목록을 불러오지 못했습니다.')
    } finally {
      setRulesLoading(false)
    }
  }, [token])

  const selectedRule = useMemo(
    () => rules.find((rule) => rule.id === selectedRuleId) ?? null,
    [rules, selectedRuleId],
  )

  const filteredRules = useMemo(() => {
    const q = listSearch.trim().toLowerCase()
    return rules
      .filter((rule) => matchesListFilter(rule, listFilter))
      .filter((rule) => !q || rule.name.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [listFilter, listSearch, rules])

  const selectedGroup = useMemo(() => {
    const groupId = Number(form.recipientGroupId)
    if (!Number.isFinite(groupId) || groupId <= 0) {
      return null
    }
    return groups.find((group) => group.id === groupId) ?? null
  }, [form.recipientGroupId, groups])

  const memberSummary = useMemo(() => {
    const mapped = groupMembers.map((row) => ({
      customerId: row.customerId,
      name: row.name,
      gender: row.gender,
      genderLabel: row.genderLabel,
      birthDate: row.birthDate,
      phone: row.phone,
      phoneDisplay: row.phoneDisplay,
      insuranceAge: row.insuranceAge,
      sangnyeongDday: row.sangnyeongDday,
      sangnyeongLabel: row.sangnyeongLabel,
      canSend: row.canSend,
      blockedReason: row.blockedReason,
    }))
    return summarizeSelectedRecipients(mapped)
  }, [groupMembers])

  const previewSample = useMemo(() => {
    const sendable = groupMembers.find((row) => row.canSend) ?? groupMembers[0] ?? null
    return sendable
  }, [groupMembers, previewRefreshKey])

  const validation = useMemo(
    () =>
      validateSmsScheduledSave({
        form,
        sendableCount: memberSummary.sendable,
        groupMembersLoading: membersBusy,
      }),
    [form, memberSummary.sendable, membersBusy],
  )
  const canSave = validation.canSave && !saveBusy
  const showEditor = isCreating || selectedRuleId != null
  const runHistory: SmsScheduledRunHistoryItem[] = []

  const scheduleSummaryNextRun = useMemo(
    () => formatNextRunAtLabel(computeNextRunAtPreview(form)),
    [form, previewRefreshKey],
  )

  useEffect(() => {
    if (!userKey) {
      setRules([])
      return
    }
    void reloadRules()
  }, [userKey, reloadRules])

  useEffect(() => {
    if (!token?.trim()) {
      setGroups([])
      return
    }
    let cancelled = false
    void fetchSmsRecipientGroups(token)
      .then((rows) => {
        if (!cancelled) {
          setGroups(rows)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGroups([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    const groupId = Number(form.recipientGroupId)
    if (!token?.trim() || !Number.isFinite(groupId) || groupId <= 0) {
      setGroupMembers([])
      return
    }
    let cancelled = false
    setMembersBusy(true)
    void fetchSmsRecipientGroupMembers(token, groupId)
      .then((result) => {
        if (!cancelled) {
          setGroupMembers(Array.isArray(result.customers) ? result.customers : [])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGroupMembers([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMembersBusy(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [form.recipientGroupId, token])

  const startCreate = useCallback(() => {
    setSelectedRuleId(null)
    setIsCreating(true)
    setForm({ ...EMPTY_SMS_SCHEDULED_FORM })
    setActionNotice(null)
    setMobilePanel('settings')
  }, [])

  const selectRule = useCallback((ruleId: string) => {
    setIsCreating(false)
    setSelectedRuleId(ruleId)
    setActionNotice(null)
    setMobilePanel('settings')
  }, [])

  const cancelEdit = useCallback(() => {
    if (selectedRule) {
      setForm(ruleToForm(selectedRule))
      setIsCreating(false)
      return
    }
    setIsCreating(false)
    setSelectedRuleId(null)
    setForm({ ...EMPTY_SMS_SCHEDULED_FORM })
  }, [selectedRule])

  const updateForm = useCallback((patch: Partial<SmsScheduledFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const applyTemplate = useCallback(
    (templateId: string) => {
      if (!templateId) {
        updateForm({ templateId: '' })
        return
      }
      const template = templates.find((row) => String(row.id) === templateId)
      if (!template) {
        updateForm({ templateId })
        return
      }
      updateForm({
        templateId,
        messageBody: template.message,
        messageType: template.messageType,
      })
    },
    [templates, updateForm],
  )

  const refreshPreview = useCallback(() => {
    setPreviewRefreshKey((prev) => prev + 1)
    setActionNotice('미리보기를 갱신했습니다.')
  }, [])

  const saveRule = useCallback(
    async (patch?: Partial<SmsScheduledFormState>) => {
      const merged = patch ? { ...form, ...patch } : form
      if (
        !isSmsScheduledSaveValid({
          form: merged,
          sendableCount: memberSummary.sendable,
          groupMembersLoading: membersBusy,
        })
      ) {
        return
      }
      if (!token?.trim()) {
        setActionNotice('로그인이 필요합니다.')
        return
      }
      setSaveBusy(true)
      setActionNotice(null)
      try {
        const created = await createSmsScheduledMessage(token, {
          name: merged.name.trim(),
          description: merged.description.trim() || undefined,
          recipientGroupId: merged.recipientGroupId,
          messageBody: merged.messageBody,
          messageType: merged.messageType,
          scheduleType: merged.scheduleType,
          sendDate: merged.scheduleType === 'once' ? merged.sendDate : undefined,
          sendTime: merged.sendTime,
          timezone: 'Asia/Seoul',
          weekdays: merged.scheduleType === 'weekly' ? merged.weekdays : undefined,
          monthDay: merged.scheduleType === 'monthly' ? merged.monthDay : undefined,
          templateId: merged.templateId || undefined,
          enabled: merged.enabled,
        })
        const nextRule = dtoToRule(created)
        setRules((prev) => [nextRule, ...prev.filter((rule) => rule.id !== nextRule.id)])
        setSelectedRuleId(nextRule.id)
        setIsCreating(false)
        setForm(merged)
        setActionNotice('예약이 서버에 저장되었습니다. 예약 시간에 자동 발송됩니다.')
        setMobilePanel('preview')
        void reloadRules()
      } catch (err) {
        setActionNotice(err instanceof Error ? err.message : '예약 저장에 실패했습니다.')
      } finally {
        setSaveBusy(false)
      }
    },
    [form, memberSummary.sendable, membersBusy, reloadRules, token],
  )

  const disableRule = useCallback(() => {
    setActionNotice('예약 비활성화는 예약현황에서 삭제 후 다시 등록해 주세요.')
  }, [])

  const deleteRule = useCallback(async () => {
    if (!selectedRule || !token?.trim()) {
      return
    }
    const ok = await confirm({
      title: '예약문자 삭제',
      message:
        '예약문자를 삭제하시겠습니까?\n삭제하면 해당 예약 규칙은 더 이상 실행되지 않습니다.',
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'danger',
    })
    if (!ok) {
      return
    }
    try {
      await deleteSmsScheduledMessage(token, selectedRule.id)
      setRules((prev) => prev.filter((rule) => rule.id !== selectedRule.id))
      setSelectedRuleId(null)
      setIsCreating(false)
      setForm({ ...EMPTY_SMS_SCHEDULED_FORM })
      setActionNotice('예약문자를 삭제했습니다.')
      setMobilePanel('list')
    } catch (err) {
      setActionNotice(err instanceof Error ? err.message : '예약 삭제에 실패했습니다.')
    }
  }, [confirm, selectedRule, token])

  const deleteRuleById = useCallback(
    async (ruleId: string) => {
      if (!token?.trim()) {
        return
      }
      try {
        await deleteSmsScheduledMessage(token, ruleId)
        setRules((prev) => prev.filter((rule) => rule.id !== ruleId))
        if (selectedRuleId === ruleId) {
          setSelectedRuleId(null)
          setIsCreating(false)
          setForm({ ...EMPTY_SMS_SCHEDULED_FORM })
        }
        setActionNotice('예약문자를 삭제했습니다.')
      } catch (err) {
        setActionNotice(err instanceof Error ? err.message : '예약 삭제에 실패했습니다.')
      }
    },
    [selectedRuleId, token],
  )

  const copyRule = useCallback((rule: SmsScheduledRule) => {
    const copied = ruleToForm(rule)
    copied.name = `${rule.name} 복사본`
    setForm(copied)
    setSelectedRuleId(null)
    setIsCreating(true)
    setActionNotice('예약을 복사했습니다. 저장하면 새 예약 규칙이 생성됩니다.')
    setMobilePanel('settings')
  }, [])

  useEffect(() => {
    if (selectedRule && !isCreating) {
      setForm(ruleToForm(selectedRule))
    }
  }, [selectedRule, isCreating])

  return {
    confirmDialog,
    rules,
    filteredRules,
    rulesLoading,
    rulesError,
    saveBusy,
    groups,
    groupMembers,
    membersBusy,
    listFilter,
    setListFilter,
    listSearch,
    setListSearch,
    selectedRuleId,
    selectedRule,
    isCreating,
    showEditor,
    form,
    updateForm,
    applyTemplate,
    mobilePanel,
    setMobilePanel,
    actionNotice,
    setActionNotice,
    validation,
    canSave,
    selectedGroup,
    memberSummary,
    previewSample,
    runHistory,
    scheduleSummaryNextRun,
    startCreate,
    selectRule,
    cancelEdit,
    refreshPreview,
    saveRule,
    disableRule,
    deleteRule,
    deleteRuleById,
    copyRule,
    reloadRules,
    formatBlockedReason: formatSmsBlockedReason,
  }
}

export type SmsScheduledState = ReturnType<typeof useSmsScheduledState>

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useConfirmDialog } from '../../../components/dialog'
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
  type SmsScheduledRunHistoryItem,
} from '../types/smsScheduled.types'
import {
  computeNextRunAtPreview,
  formatNextRunAtLabel,
} from '../utils/smsScheduledSummary'
import {
  createScheduledRuleId,
  loadSmsScheduledRules,
  saveSmsScheduledRules,
} from '../utils/smsScheduledStorage'
import { isSmsScheduledFormValid, validateSmsScheduledForm } from '../utils/smsScheduledValidation'
import { formatSmsBlockedReason, summarizeSelectedRecipients } from '../utils/smsRecipientEligibility'

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

function formToRule(form: SmsScheduledFormState, existing?: SmsScheduledRule | null): SmsScheduledRule {
  const now = new Date().toISOString()
  const nextRunAt = computeNextRunAtPreview(form)
  return {
    id: existing?.id ?? createScheduledRuleId(),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    enabled: form.enabled,
    scheduleType: form.scheduleType,
    sendDate: form.scheduleType === 'once' ? form.sendDate : undefined,
    sendTime: form.sendTime,
    weekdays: form.scheduleType === 'weekly' ? [...form.weekdays].sort((a, b) => a - b) : undefined,
    monthDay: form.scheduleType === 'monthly' ? form.monthDay : undefined,
    recipientGroupId: form.recipientGroupId,
    templateId: form.templateId || undefined,
    messageBody: form.messageBody,
    messageType: form.messageType,
    nextRunAt,
    lastRunAt: existing?.lastRunAt ?? null,
    status: form.enabled ? 'active' : 'inactive',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
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

  const validation = useMemo(() => validateSmsScheduledForm(form), [form])
  const canSave = validation.valid
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
    setRules(loadSmsScheduledRules(userKey))
  }, [userKey])

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

  const persistRules = useCallback(
    (nextRules: SmsScheduledRule[]) => {
      setRules(nextRules)
      if (userKey) {
        saveSmsScheduledRules(userKey, nextRules)
      }
    },
    [userKey],
  )

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

  const saveRule = useCallback(() => {
    if (!isSmsScheduledFormValid(form)) {
      return
    }
    const nextRule = formToRule(form, selectedRule)
    const nextRules = selectedRule
      ? rules.map((rule) => (rule.id === selectedRule.id ? nextRule : rule))
      : [nextRule, ...rules]
    persistRules(nextRules)
    setSelectedRuleId(nextRule.id)
    setIsCreating(false)
    setActionNotice('예약문자를 저장했습니다.')
    setMobilePanel('preview')
  }, [form, persistRules, rules, selectedRule])

  const disableRule = useCallback(() => {
    if (!selectedRule) {
      return
    }
    const nextRule = { ...selectedRule, enabled: false, status: 'inactive' as const, updatedAt: new Date().toISOString() }
    persistRules(rules.map((rule) => (rule.id === selectedRule.id ? nextRule : rule)))
    setForm((prev) => ({ ...prev, enabled: false }))
    setActionNotice('예약문자를 비활성화했습니다.')
  }, [persistRules, rules, selectedRule])

  const deleteRule = useCallback(async () => {
    if (!selectedRule) {
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
    persistRules(rules.filter((rule) => rule.id !== selectedRule.id))
    setSelectedRuleId(null)
    setIsCreating(false)
    setForm({ ...EMPTY_SMS_SCHEDULED_FORM })
    setActionNotice('예약문자를 삭제했습니다.')
    setMobilePanel('list')
  }, [confirm, persistRules, rules, selectedRule])

  useEffect(() => {
    if (selectedRule && !isCreating) {
      setForm(ruleToForm(selectedRule))
    }
  }, [selectedRule?.id, isCreating])

  return {
    confirmDialog,
    rules,
    filteredRules,
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
    formatBlockedReason: formatSmsBlockedReason,
  }
}

export type SmsScheduledState = ReturnType<typeof useSmsScheduledState>

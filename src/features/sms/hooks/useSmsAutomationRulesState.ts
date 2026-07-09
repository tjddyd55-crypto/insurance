import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import {
  createSmsAutomationRule,
  deleteSmsAutomationRule,
  fetchSmsAutomationRules,
  previewSmsAutomationRule,
  updateSmsAutomationRule,
} from '../api/smsAutomationRulesApi'
import {
  createEmptySmsAutomationRuleForm,
  SMS_AUTOMATION_DEFAULT_MESSAGE_BY_TRIGGER,
} from '../config/smsAutomationRule.config'
import type {
  SmsAutomationRule,
  SmsAutomationRuleFormState,
  SmsAutomationRulePreview,
  SmsAutomationTriggerType,
} from '../types/smsAutomationRuleTypes'

export type UseSmsAutomationRulesStateResult = {
  loading: boolean
  saving: boolean
  error: string | null
  notice: string | null
  rules: SmsAutomationRule[]
  selectedRuleId: number | null
  selectedRule: SmsAutomationRule | null
  form: SmsAutomationRuleFormState
  preview: SmsAutomationRulePreview | null
  previewLoading: boolean
  isCreating: boolean
  selectRule: (ruleId: number | null) => void
  startCreate: () => void
  updateForm: (patch: Partial<SmsAutomationRuleFormState>) => void
  changeTriggerType: (triggerType: SmsAutomationTriggerType) => void
  saveForm: () => Promise<void>
  removeSelected: () => Promise<void>
  loadPreview: () => Promise<void>
  reload: () => Promise<void>
  clearNotice: () => void
}

function ruleToForm(rule: SmsAutomationRule): SmsAutomationRuleFormState {
  return {
    id: rule.id,
    ruleName: rule.ruleName,
    triggerType: rule.triggerType,
    specialDatePurposeType: rule.specialDatePurposeType,
    dayOffset: rule.dayOffset,
    sendTime: rule.sendTime,
    messageBody: rule.messageBody,
    isActive: rule.isActive,
  }
}

export function useSmsAutomationRulesState(): UseSmsAutomationRulesStateResult {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [rules, setRules] = useState<SmsAutomationRule[]>([])
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState<SmsAutomationRuleFormState>(() => createEmptySmsAutomationRuleForm())
  const [preview, setPreview] = useState<SmsAutomationRulePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const selectedRule = useMemo(
    () => rules.find((r) => r.id === selectedRuleId) ?? null,
    [rules, selectedRuleId],
  )

  const reload = useCallback(async () => {
    if (!token?.trim()) {
      setRules([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchSmsAutomationRules(token)
      setRules(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : '자동문자 규칙을 불러오지 못했습니다.')
      setRules([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void reload()
  }, [reload])

  const selectRule = useCallback(
    (ruleId: number | null) => {
      setIsCreating(false)
      setSelectedRuleId(ruleId)
      setPreview(null)
      if (ruleId == null) {
        setForm(createEmptySmsAutomationRuleForm())
        return
      }
      const hit = rules.find((r) => r.id === ruleId)
      if (hit) {
        setForm(ruleToForm(hit))
      }
    },
    [rules],
  )

  const startCreate = useCallback(() => {
    setIsCreating(true)
    setSelectedRuleId(null)
    setPreview(null)
    setForm(createEmptySmsAutomationRuleForm())
    setNotice(null)
    setError(null)
  }, [])

  const updateForm = useCallback((patch: Partial<SmsAutomationRuleFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const changeTriggerType = useCallback((triggerType: SmsAutomationTriggerType) => {
    setForm((prev) => ({
      ...prev,
      triggerType,
      specialDatePurposeType: triggerType === 'CUSTOMER_SPECIAL_DATE' ? 'ALL' : null,
      messageBody:
        prev.messageBody.trim() === '' ||
        prev.messageBody === SMS_AUTOMATION_DEFAULT_MESSAGE_BY_TRIGGER[prev.triggerType]
          ? SMS_AUTOMATION_DEFAULT_MESSAGE_BY_TRIGGER[triggerType]
          : prev.messageBody,
    }))
  }, [])

  const saveForm = useCallback(async () => {
    if (!token?.trim()) {
      setError('로그인이 필요합니다.')
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const payload = {
        ruleName: form.ruleName.trim(),
        triggerType: form.triggerType,
        specialDatePurposeType:
          form.triggerType === 'CUSTOMER_SPECIAL_DATE' ? form.specialDatePurposeType ?? 'ALL' : null,
        dayOffset: form.dayOffset,
        sendTime: form.sendTime,
        messageBody: form.messageBody.trim(),
        isActive: form.isActive,
      }
      if (!payload.ruleName) {
        setError('규칙명을 입력해 주세요.')
        return
      }
      if (!payload.messageBody) {
        setError('문자 내용을 입력해 주세요.')
        return
      }
      let saved: SmsAutomationRule
      if (isCreating || form.id == null) {
        saved = await createSmsAutomationRule(token, payload)
        setIsCreating(false)
        setSelectedRuleId(saved.id)
        setForm(ruleToForm(saved))
        setNotice('자동문자 규칙을 등록했습니다.')
      } else {
        saved = await updateSmsAutomationRule(token, form.id, payload)
        setForm(ruleToForm(saved))
        setNotice('자동문자 규칙을 저장했습니다.')
      }
      await reload()
      setSelectedRuleId(saved.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : '자동문자 규칙 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }, [form, isCreating, reload, token])

  const removeSelected = useCallback(async () => {
    if (!token?.trim() || form.id == null) {
      return
    }
    if (!window.confirm('이 자동문자 규칙을 삭제하시겠습니까?')) {
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await deleteSmsAutomationRule(token, form.id)
      setNotice('자동문자 규칙을 삭제했습니다.')
      setSelectedRuleId(null)
      setIsCreating(false)
      setForm(createEmptySmsAutomationRuleForm())
      setPreview(null)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '자동문자 규칙 삭제에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }, [form.id, reload, token])

  const loadPreview = useCallback(async () => {
    if (!token?.trim() || form.id == null) {
      setPreview(null)
      return
    }
    setPreviewLoading(true)
    setError(null)
    try {
      const data = await previewSmsAutomationRule(token, form.id)
      setPreview(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '대상자 미리보기를 불러오지 못했습니다.')
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }, [form.id, token])

  const clearNotice = useCallback(() => {
    setNotice(null)
    setError(null)
  }, [])

  return {
    loading,
    saving,
    error,
    notice,
    rules,
    selectedRuleId,
    selectedRule,
    form,
    preview,
    previewLoading,
    isCreating,
    selectRule,
    startCreate,
    updateForm,
    changeTriggerType,
    saveForm,
    removeSelected,
    loadPreview,
    reload,
    clearNotice,
  }
}

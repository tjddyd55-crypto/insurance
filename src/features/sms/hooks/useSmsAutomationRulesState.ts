import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import {
  createSmsAutomationRule,
  deleteSmsAutomationRule,
  fetchSmsAutomationRunDetail,
  fetchSmsAutomationRules,
  formatSmsAutomationRunError,
  previewSmsAutomationRule,
  runSmsAutomationRule,
  updateSmsAutomationRule,
} from '../api/smsAutomationRulesApi'
import { fetchSmsSettings } from '../api/smsApi'
import {
  createEmptySmsAutomationRuleForm,
  getAutomationPreviewBaseDateDefault,
  SMS_AUTOMATION_DEFAULT_MESSAGE_BY_TRIGGER,
} from '../config/smsAutomationRule.config'
import type {
  SmsAutomationRule,
  SmsAutomationRuleFormState,
  SmsAutomationRulePreview,
  SmsAutomationRuleStats,
  SmsAutomationRunDetail,
  SmsAutomationRunResult,
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
  previewBaseDate: string
  stats: SmsAutomationRuleStats
  runLoading: boolean
  runResult: SmsAutomationRunResult | null
  runDetail: SmsAutomationRunDetail | null
  runDetailLoading: boolean
  realSendEnabled: boolean
  isCreating: boolean
  selectRule: (ruleId: number | null) => void
  startCreate: () => void
  updateForm: (patch: Partial<SmsAutomationRuleFormState>) => void
  changeTriggerType: (triggerType: SmsAutomationTriggerType) => void
  saveForm: () => Promise<void>
  removeSelected: () => Promise<void>
  loadPreview: (baseDate?: string) => Promise<void>
  runSimulation: () => Promise<void>
  runRealSend: () => Promise<void>
  loadRunDetail: (runId: number) => Promise<void>
  clearRunDetail: () => void
  setPreviewBaseDate: (value: string) => void
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
    excludeMinors: rule.excludeMinors,
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
  const [previewBaseDate, setPreviewBaseDate] = useState(() => getAutomationPreviewBaseDateDefault())
  const [runLoading, setRunLoading] = useState(false)
  const [runResult, setRunResult] = useState<SmsAutomationRunResult | null>(null)
  const [runDetail, setRunDetail] = useState<SmsAutomationRunDetail | null>(null)
  const [runDetailLoading, setRunDetailLoading] = useState(false)
  const [realSendEnabled, setRealSendEnabled] = useState(false)

  const stats = useMemo<SmsAutomationRuleStats>(() => {
    const active = rules.filter((rule) => rule.isActive).length
    return {
      total: rules.length,
      active,
      inactive: rules.length - active,
    }
  }, [rules])

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

  useEffect(() => {
    if (!token?.trim()) {
      setRealSendEnabled(false)
      return
    }
    void fetchSmsSettings(token)
      .then((settings) => setRealSendEnabled(settings.realSendEnabled === true))
      .catch(() => setRealSendEnabled(false))
  }, [token])

  const selectRule = useCallback(
    (ruleId: number | null) => {
      setIsCreating(false)
      setSelectedRuleId(ruleId)
      setPreview(null)
      setRunResult(null)
      setRunDetail(null)
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
        excludeMinors: form.excludeMinors,
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
      setRunResult(null)
      setRunDetail(null)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '자동문자 규칙 삭제에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }, [form.id, reload, token])

  const loadPreview = useCallback(
    async (baseDate?: string) => {
      if (!token?.trim() || form.id == null) {
        setPreview(null)
      setRunResult(null)
      setRunDetail(null)
        return
      }
      const effectiveBaseDate = (baseDate ?? previewBaseDate).trim() || getAutomationPreviewBaseDateDefault()
      setPreviewLoading(true)
      setError(null)
      try {
        const data = await previewSmsAutomationRule(token, form.id, effectiveBaseDate)
        setPreview(data)
        setPreviewBaseDate(effectiveBaseDate)
      } catch (e) {
        setError(e instanceof Error ? e.message : '대상자 미리보기를 불러오지 못했습니다.')
        setPreview(null)
      setRunResult(null)
      setRunDetail(null)
      } finally {
        setPreviewLoading(false)
      }
    },
    [form.id, previewBaseDate, token],
  )

  const runSimulation = useCallback(async () => {
    if (!token?.trim() || form.id == null) {
      return
    }
    setRunLoading(true)
    setError(null)
    setNotice(null)
    setRunDetail(null)
    try {
      const data = await runSmsAutomationRule(token, form.id, {
        baseDate: previewBaseDate,
        realSend: false,
      })
      setRunResult(data)
      setRealSendEnabled(data.realSendEnabled)
      setNotice(
        data.mode === 'SIMULATED_SEND'
          ? `모의 실행이 완료되었습니다. (발송 가능 ${data.summary.sendable}명)`
          : '실행이 완료되었습니다.',
      )
    } catch (e) {
      setError(formatSmsAutomationRunError(e, '모의 실행에 실패했습니다.'))
    } finally {
      setRunLoading(false)
    }
  }, [form.id, previewBaseDate, token])

  const runRealSend = useCallback(async () => {
    if (!token?.trim() || form.id == null) {
      return
    }
    setRunLoading(true)
    setError(null)
    setNotice(null)
    setRunDetail(null)
    try {
      const data = await runSmsAutomationRule(token, form.id, {
        baseDate: previewBaseDate,
        realSend: true,
      })
      setRunResult(data)
      setRealSendEnabled(data.realSendEnabled)
      if (data.mode === 'SIMULATED_SEND') {
        setNotice(
          `실제 발송이 비활성화되어 모의 실행으로 처리되었습니다. (발송 가능 ${data.summary.sendable}명)`,
        )
      } else {
        setNotice(`실제 발송이 완료되었습니다. (성공 ${data.summary.sent}명, 실패 ${data.summary.failed}명)`)
      }
    } catch (e) {
      setError(formatSmsAutomationRunError(e, '실제 발송 실행에 실패했습니다.'))
    } finally {
      setRunLoading(false)
    }
  }, [form.id, previewBaseDate, token])

  const loadRunDetail = useCallback(
    async (runId: number) => {
      if (!token?.trim()) {
        return
      }
      setRunDetailLoading(true)
      setError(null)
      try {
        const detail = await fetchSmsAutomationRunDetail(token, runId)
        setRunDetail(detail)
      } catch (e) {
        setError(e instanceof Error ? e.message : '실행 상세를 불러오지 못했습니다.')
      } finally {
        setRunDetailLoading(false)
      }
    },
    [token],
  )

  const clearRunDetail = useCallback(() => {
    setRunDetail(null)
  }, [])

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
    previewBaseDate,
    stats,
    runLoading,
    runResult,
    runDetail,
    runDetailLoading,
    realSendEnabled,
    isCreating,
    selectRule,
    startCreate,
    updateForm,
    changeTriggerType,
    saveForm,
    removeSelected,
    loadPreview,
    runSimulation,
    runRealSend,
    loadRunDetail,
    clearRunDetail,
    setPreviewBaseDate,
    reload,
    clearNotice,
  }
}

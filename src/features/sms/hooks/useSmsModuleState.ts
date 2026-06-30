import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import {
  addSmsOptOut,
  cancelSmsCampaign,
  createSmsCampaign,
  createSmsTemplate,
  deleteSmsSettings,
  deleteSmsTemplate,
  fetchSmsBalance,
  fetchSmsCampaigns,
  fetchSmsHistory,
  fetchSmsOptOuts,
  fetchSmsSenders,
  fetchSmsSettings,
  fetchSmsTemplates,
  previewSmsCampaign,
  removeSmsOptOut,
  saveSmsSettings,
  sendSingleSms,
  sendSmsCampaign,
  testSmsSend,
} from '../api/smsApi'
import { ApiError } from '../../../lib/apiClient'
import {
  EMPTY_SMS_SETTINGS,
  normalizeSmsSettings,
  type SmsCampaignPreview,
  type SmsCampaignSummary,
  type SmsModuleTab,
  type SmsOptOut,
  type SmsSender,
  type SmsSettings,
  type SmsTemplate,
} from '../types/sms.types'
import type { SmsPreviewAttachment } from '../utils/smsMessageMeta'

export type SmsModuleViewProps = ReturnType<typeof useSmsModuleState>

const AUTH_REQUIRED_MESSAGE = '로그인이 필요합니다. 다시 로그인해 주세요.'

export function useSmsModuleState(initialTab: SmsModuleTab = 'settings') {
  const { token } = useAuth()
  const [tab, setTab] = useState<SmsModuleTab>(initialTab)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authRequired, setAuthRequired] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [moduleDisabled, setModuleDisabled] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [settings, setSettings] = useState<SmsSettings | null>(null)
  const [senders, setSenders] = useState<SmsSender[]>([])
  const [templates, setTemplates] = useState<SmsTemplate[]>([])
  const [history, setHistory] = useState<SmsCampaignSummary[]>([])
  const [campaigns, setCampaigns] = useState<SmsCampaignSummary[]>([])
  const [optOuts, setOptOuts] = useState<SmsOptOut[]>([])
  const [balanceText, setBalanceText] = useState<string | null>(null)
  const [preview, setPreview] = useState<SmsCampaignPreview | null>(null)
  const [previewAcknowledged, setPreviewAcknowledged] = useState(false)

  const [settingsForm, setSettingsForm] = useState({
    aligoUserIdChange: '',
    apiKeyChange: '',
    defaultSenderChange: '',
    adDisplayNameChange: '',
    testReceiver: '',
    testMessage: 'CRM 문자 연동 테스트입니다.',
  })

  const [sendForm, setSendForm] = useState({
    senderNumber: '',
    receiver: '',
    message: '',
    messageType: 'info' as 'info' | 'ad',
    imageAttachment: null as SmsPreviewAttachment,
  })

  const [bulkForm, setBulkForm] = useState({
    title: '단체문자',
    senderNumber: '',
    message: '',
    customerIdsText: '',
    scheduledAt: '',
    messageType: 'info' as 'info' | 'ad',
    imageAttachment: null as SmsPreviewAttachment,
  })

  const [templateForm, setTemplateForm] = useState({
    title: '',
    message: '',
    messageType: 'info' as 'info' | 'ad',
    imageAttachment: null as SmsPreviewAttachment,
  })

  const [optOutForm, setOptOutForm] = useState({ phone: '', reason: '' })

  const verifiedSenders = useMemo(
    () => senders.filter((s) => s.status === 'verified'),
    [senders],
  )

  const reloadCore = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAuthRequired(false)
    setSettingsLoaded(false)
    setModuleDisabled(false)
    if (!token?.trim()) {
      setSettings(null)
      setSenders([])
      setTemplates([])
      setHistory([])
      setCampaigns([])
      setOptOuts([])
      setAuthRequired(true)
      setError(AUTH_REQUIRED_MESSAGE)
      setLoading(false)
      return
    }
    try {
      const [settingsRes, sendersRes, templatesRes, historyRes, campaignsRes, optOutsRes] =
        await Promise.all([
          fetchSmsSettings(token),
          fetchSmsSenders(token),
          fetchSmsTemplates(token),
          fetchSmsHistory(token),
          fetchSmsCampaigns(token),
          fetchSmsOptOuts(token),
        ])
      const normalizedSettings = normalizeSmsSettings(settingsRes)
      const normalizedSenders = Array.isArray(sendersRes) ? sendersRes : []
      setSettings(normalizedSettings)
      setSettingsLoaded(true)
      setSenders(normalizedSenders)
      setTemplates(Array.isArray(templatesRes) ? templatesRes : [])
      setHistory(Array.isArray(historyRes) ? historyRes : [])
      setCampaigns(Array.isArray(campaignsRes) ? campaignsRes : [])
      setOptOuts(Array.isArray(optOutsRes) ? optOutsRes : [])
      setSettingsForm((prev) => ({
        ...prev,
        aligoUserIdChange: '',
        apiKeyChange: '',
        defaultSenderChange: '',
        adDisplayNameChange: '',
      }))
      const defaultSender =
        normalizedSenders.find((s) => s.isDefault && s.status === 'verified')?.senderNumber ??
        normalizedSenders.find((s) => s.status === 'verified')?.senderNumber ??
        normalizedSettings.defaultSender ??
        ''
      setSendForm((prev) => ({ ...prev, senderNumber: prev.senderNumber || defaultSender }))
      setBulkForm((prev) => ({ ...prev, senderNumber: prev.senderNumber || defaultSender }))
    } catch (e) {
      if (e instanceof ApiError && e.code === 'sms_module_disabled') {
        setModuleDisabled(true)
        setSettings({ ...EMPTY_SMS_SETTINGS, moduleEnabled: false })
        setSettingsLoaded(true)
        setSenders([])
        setTemplates([])
        setHistory([])
        setCampaigns([])
        setOptOuts([])
        setError(null)
      } else if (e instanceof ApiError && e.status === 401) {
        setAuthRequired(true)
        setSettings(null)
        setSenders([])
        setTemplates([])
        setHistory([])
        setCampaigns([])
        setOptOuts([])
        setError(AUTH_REQUIRED_MESSAGE)
      } else {
        setSettings(null)
        setError(e instanceof Error ? e.message : '문자 데이터를 불러오지 못했습니다.')
      }
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void reloadCore()
  }, [reloadCore])

  const runBusy = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : '요청 처리에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }, [])

  const handleSaveSettings = useCallback(async () => {
    await runBusy(async () => {
      const aligoUserId =
        settingsForm.aligoUserIdChange.trim() || settings?.aligoUserId?.trim() || ''
      const defaultSender =
        settingsForm.defaultSenderChange.trim() || settings?.defaultSender?.trim() || ''
      const apiKey = settingsForm.apiKeyChange.trim() || undefined
      const adDisplayName = settingsForm.adDisplayNameChange.trim() || undefined

      if (!aligoUserId) {
        throw new Error('알리고 아이디를 입력해 주세요.')
      }
      if (!defaultSender) {
        throw new Error('알리고에 등록된 발신번호를 입력해 주세요.')
      }
      if (!settings?.configured && !apiKey) {
        throw new Error('API Key를 입력해 주세요.')
      }

      const saved = await saveSmsSettings(token, {
        aligoUserId,
        apiKey,
        defaultSender,
        adDisplayName,
      })
      setSettings(saved)
      setSettingsLoaded(true)
      setSettingsForm((prev) => ({
        ...prev,
        aligoUserIdChange: '',
        apiKeyChange: '',
        defaultSenderChange: '',
        adDisplayNameChange: '',
      }))
      setNotice('알리고 연동 설정과 기본 발신번호가 저장되었습니다.')
      await reloadCore()
    })
  }, [runBusy, settingsForm, settings, reloadCore, token])

  const handleDeleteSettings = useCallback(async () => {
    await runBusy(async () => {
      const saved = await deleteSmsSettings(token)
      setSettings(saved)
      setSettingsLoaded(true)
      setNotice('알리고 연동을 해제했습니다.')
      await reloadCore()
    })
  }, [runBusy, reloadCore, token])

  const handleTestSend = useCallback(async () => {
    await runBusy(async () => {
      const sender =
        settings?.defaultSender?.trim() ||
        settingsForm.defaultSenderChange.trim() ||
        sendForm.senderNumber
      const result = await testSmsSend(token, {
        senderNumber: sender,
        receiver: settingsForm.testReceiver.trim(),
        message: settingsForm.testMessage.trim(),
      })
      if (!result.success) {
        throw new Error(result.errorMessage ?? '테스트 발송에 실패했습니다.')
      }
      setNotice(
        (result as { notice?: string }).notice ??
          ((result as { verifiedApplied?: boolean }).verifiedApplied
            ? '테스트 발송에 성공했습니다. 발신번호가 검증 상태로 변경되었습니다.'
            : '테스트 발송 결과를 저장했습니다. mock/testmode는 verified 처리되지 않습니다.'),
      )
      await reloadCore()
    })
  }, [runBusy, settingsForm, settings, sendForm.senderNumber, reloadCore, token])

  const handleFetchBalance = useCallback(async () => {
    await runBusy(async () => {
      const result = await fetchSmsBalance(token)
      if (!result.success) {
        throw new Error(
          result.errorMessage ??
            '잔액 조회에 실패했습니다. API Key, 서버 IP 등록, 알리고 계정 상태를 확인해 주세요.',
        )
      }
      setBalanceText(result.balanceText ?? '(단문) 0건 (장문) 0건 (그림) 0건')
    })
  }, [runBusy, token])

  const handleSendSingle = useCallback(async () => {
    await runBusy(async () => {
      const result = await sendSingleSms(token, {
        senderNumber: sendForm.senderNumber,
        receiver: sendForm.receiver,
        message: sendForm.message,
        messageType: sendForm.messageType,
      })
      if (!result.success) {
        throw new Error(result.errorMessage ?? '문자 발송에 실패했습니다.')
      }
      setNotice(`문자를 발송했습니다. (이력 ID: ${result.campaignId ?? '-'})`)
      setSendForm((prev) => ({ ...prev, message: '' }))
      await reloadCore()
    })
  }, [runBusy, sendForm, reloadCore, token])

  const parseCustomerIds = useCallback((raw: string) => {
    return raw
      .split(/[\s,;]+/)
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
  }, [])

  const handlePreviewBulk = useCallback(async () => {
    await runBusy(async () => {
      const previewResult = await previewSmsCampaign(token, {
        senderNumber: bulkForm.senderNumber,
        message: bulkForm.message,
        customerIds: parseCustomerIds(bulkForm.customerIdsText),
      })
      setPreview(previewResult)
      setPreviewAcknowledged(true)
    })
  }, [runBusy, bulkForm, parseCustomerIds, token])

  const handleCreateBulk = useCallback(async (scheduled: boolean) => {
    if (!scheduled && !previewAcknowledged) {
      setError('단체문자 즉시 발송 전에 발송 미리보기를 실행해 주세요.')
      return
    }
    await runBusy(async () => {
      const created = await createSmsCampaign(token, {
        title: bulkForm.title,
        senderNumber: bulkForm.senderNumber,
        message: bulkForm.message,
        customerIds: parseCustomerIds(bulkForm.customerIdsText),
        scheduledAt: scheduled ? bulkForm.scheduledAt || null : null,
        messageType: bulkForm.messageType,
      })
      if (created.status === 'scheduled') {
        setNotice('예약 캠페인을 저장했습니다. 자동 발송 worker는 후속 작업 예정입니다.')
      } else {
        const sent = await sendSmsCampaign(token, created.campaignId, previewAcknowledged)
        setNotice(`단체문자 발송 완료 — 성공 ${sent.successCount} / 실패 ${sent.failCount}`)
      }
      setPreview(null)
      setPreviewAcknowledged(false)
      await reloadCore()
    })
  }, [runBusy, bulkForm, parseCustomerIds, previewAcknowledged, reloadCore, token])

  const handleCancelCampaign = useCallback(
    async (campaignId: number) => {
      await runBusy(async () => {
        await cancelSmsCampaign(token, campaignId)
        setNotice('예약/초안 캠페인을 취소했습니다.')
        await reloadCore()
      })
    },
    [runBusy, reloadCore, token],
  )

  const handleSaveTemplate = useCallback(async () => {
    await runBusy(async () => {
      await createSmsTemplate(token, templateForm)
      setTemplateForm({ title: '', message: '', messageType: 'info', imageAttachment: null })
      setNotice('템플릿을 저장했습니다.')
      await reloadCore()
    })
  }, [runBusy, templateForm, reloadCore, token])

  const handleDeleteTemplate = useCallback(
    async (id: number) => {
      await runBusy(async () => {
        await deleteSmsTemplate(token, id)
        setNotice('템플릿을 삭제했습니다.')
        await reloadCore()
      })
    },
    [runBusy, reloadCore, token],
  )

  const handleAddOptOut = useCallback(async () => {
    await runBusy(async () => {
      await addSmsOptOut(token, optOutForm)
      setOptOutForm({ phone: '', reason: '' })
      setNotice('수신거부 번호를 등록했습니다.')
      await reloadCore()
    })
  }, [runBusy, optOutForm, reloadCore, token])

  const handleRemoveOptOut = useCallback(
    async (id: number) => {
      await runBusy(async () => {
        await removeSmsOptOut(token, id)
        setNotice('수신거부 번호를 삭제했습니다.')
        await reloadCore()
      })
    },
    [runBusy, reloadCore, token],
  )

  const scheduledCampaigns = useMemo(
    () => campaigns.filter((c) => c.status === 'scheduled' || c.status === 'draft'),
    [campaigns],
  )

  return {
    tab,
    setTab,
    loading,
    busy,
    error,
    authRequired,
    settingsLoaded,
    moduleDisabled,
    notice,
    settings,
    senders,
    verifiedSenders,
    templates,
    history,
    campaigns,
    scheduledCampaigns,
    optOuts,
    balanceText,
    preview,
    previewAcknowledged,
    settingsForm,
    setSettingsForm,
    sendForm,
    setSendForm,
    bulkForm,
    setBulkForm,
    templateForm,
    setTemplateForm,
    optOutForm,
    setOptOutForm,
    reloadCore,
    handleSaveSettings,
    handleDeleteSettings,
    handleTestSend,
    handleFetchBalance,
    handleSendSingle,
    handlePreviewBulk,
    handleCreateBulk,
    handleCancelCampaign,
    handleSaveTemplate,
    handleDeleteTemplate,
    handleAddOptOut,
    handleRemoveOptOut,
  }
}

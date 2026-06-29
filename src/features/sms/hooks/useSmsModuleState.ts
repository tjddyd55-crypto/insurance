import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addSmsOptOut,
  cancelSmsCampaign,
  createSmsCampaign,
  createSmsSender,
  createSmsTemplate,
  deleteSmsSettings,
  deleteSmsTemplate,
  detectSmsType,
  estimateSmsBytes,
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

export type SmsModuleViewProps = ReturnType<typeof useSmsModuleState>

export function useSmsModuleState(initialTab: SmsModuleTab = 'settings') {
  const [tab, setTab] = useState<SmsModuleTab>(initialTab)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    aligoUserId: '',
    apiKey: '',
    defaultSender: '',
    testReceiver: '',
    testMessage: 'CRM 문자 연동 테스트입니다.',
  })

  const [sendForm, setSendForm] = useState({
    senderNumber: '',
    receiver: '',
    message: '',
    messageType: 'info' as 'info' | 'ad',
  })

  const [bulkForm, setBulkForm] = useState({
    title: '단체문자',
    senderNumber: '',
    message: '',
    customerIdsText: '',
    scheduledAt: '',
    messageType: 'info' as 'info' | 'ad',
  })

  const [templateForm, setTemplateForm] = useState({
    title: '',
    message: '',
    messageType: 'info' as 'info' | 'ad',
  })

  const [optOutForm, setOptOutForm] = useState({ phone: '', reason: '' })

  const verifiedSenders = useMemo(
    () => senders.filter((s) => s.status === 'verified'),
    [senders],
  )

  const reloadCore = useCallback(async () => {
    setLoading(true)
    setError(null)
    setModuleDisabled(false)
    try {
      const [settingsRes, sendersRes, templatesRes, historyRes, campaignsRes, optOutsRes] =
        await Promise.all([
          fetchSmsSettings(),
          fetchSmsSenders(),
          fetchSmsTemplates(),
          fetchSmsHistory(),
          fetchSmsCampaigns(),
          fetchSmsOptOuts(),
        ])
      const normalizedSettings = normalizeSmsSettings(settingsRes)
      const normalizedSenders = Array.isArray(sendersRes) ? sendersRes : []
      setSettings(normalizedSettings)
      setSenders(normalizedSenders)
      setTemplates(Array.isArray(templatesRes) ? templatesRes : [])
      setHistory(Array.isArray(historyRes) ? historyRes : [])
      setCampaigns(Array.isArray(campaignsRes) ? campaignsRes : [])
      setOptOuts(Array.isArray(optOutsRes) ? optOutsRes : [])
      setSettingsForm((prev) => ({
        ...prev,
        aligoUserId: normalizedSettings.aligoUserId ?? '',
        defaultSender: normalizedSettings.defaultSender ?? '',
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
        setSenders([])
        setTemplates([])
        setHistory([])
        setCampaigns([])
        setOptOuts([])
        setError(null)
      } else {
        setError(e instanceof Error ? e.message : '문자 데이터를 불러오지 못했습니다.')
        setSettings((prev) => prev ?? { ...EMPTY_SMS_SETTINGS })
      }
    } finally {
      setLoading(false)
    }
  }, [])

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
      const saved = await saveSmsSettings({
        aligoUserId: settingsForm.aligoUserId.trim(),
        apiKey: settingsForm.apiKey.trim() || undefined,
        defaultSender: settingsForm.defaultSender.trim() || undefined,
      })
      setSettings(saved)
      setSettingsForm((prev) => ({ ...prev, apiKey: '' }))
      setNotice('알리고 설정을 저장했습니다. API Key 원문은 서버에만 암호화 저장됩니다.')
      await reloadCore()
    })
  }, [runBusy, settingsForm, reloadCore])

  const handleDeleteSettings = useCallback(async () => {
    await runBusy(async () => {
      const saved = await deleteSmsSettings()
      setSettings(saved)
      setNotice('알리고 연동을 해제했습니다.')
      await reloadCore()
    })
  }, [runBusy, reloadCore])

  const handleRegisterSender = useCallback(async () => {
    await runBusy(async () => {
      if (!settingsForm.defaultSender.trim()) {
        throw new Error('발신번호를 입력해 주세요.')
      }
      await createSmsSender({
        senderNumber: settingsForm.defaultSender.trim(),
        label: '기본 발신번호',
        isDefault: true,
      })
      setNotice('발신번호를 등록했습니다. 테스트 발송으로 검증해 주세요.')
      await reloadCore()
    })
  }, [runBusy, settingsForm.defaultSender, reloadCore])

  const handleTestSend = useCallback(async () => {
    await runBusy(async () => {
      const sender = settingsForm.defaultSender.trim() || sendForm.senderNumber
      const result = await testSmsSend({
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
  }, [runBusy, settingsForm, sendForm.senderNumber, reloadCore])

  const handleFetchBalance = useCallback(async () => {
    await runBusy(async () => {
      const result = await fetchSmsBalance()
      if (!result.success) {
        throw new Error(
          result.errorMessage ??
            '잔액 조회에 실패했습니다. API Key, 서버 IP 등록, 알리고 계정 상태를 확인해 주세요.',
        )
      }
      setBalanceText(result.balanceText ?? '조회 완료')
    })
  }, [runBusy])

  const handleSendSingle = useCallback(async () => {
    await runBusy(async () => {
      const result = await sendSingleSms({
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
  }, [runBusy, sendForm, reloadCore])

  const parseCustomerIds = useCallback((raw: string) => {
    return raw
      .split(/[\s,;]+/)
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
  }, [])

  const handlePreviewBulk = useCallback(async () => {
    await runBusy(async () => {
      const previewResult = await previewSmsCampaign({
        senderNumber: bulkForm.senderNumber,
        message: bulkForm.message,
        customerIds: parseCustomerIds(bulkForm.customerIdsText),
      })
      setPreview(previewResult)
      setPreviewAcknowledged(true)
    })
  }, [runBusy, bulkForm, parseCustomerIds])

  const handleCreateBulk = useCallback(async (scheduled: boolean) => {
    if (!scheduled && !previewAcknowledged) {
      setError('단체문자 즉시 발송 전에 발송 미리보기를 실행해 주세요.')
      return
    }
    await runBusy(async () => {
      const created = await createSmsCampaign({
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
        const sent = await sendSmsCampaign(created.campaignId, previewAcknowledged)
        setNotice(`단체문자 발송 완료 — 성공 ${sent.successCount} / 실패 ${sent.failCount}`)
      }
      setPreview(null)
      setPreviewAcknowledged(false)
      await reloadCore()
    })
  }, [runBusy, bulkForm, parseCustomerIds, previewAcknowledged, reloadCore])

  const handleCancelCampaign = useCallback(
    async (campaignId: number) => {
      await runBusy(async () => {
        await cancelSmsCampaign(campaignId)
        setNotice('예약/초안 캠페인을 취소했습니다.')
        await reloadCore()
      })
    },
    [runBusy, reloadCore],
  )

  const handleSaveTemplate = useCallback(async () => {
    await runBusy(async () => {
      await createSmsTemplate(templateForm)
      setTemplateForm({ title: '', message: '', messageType: 'info' })
      setNotice('템플릿을 저장했습니다.')
      await reloadCore()
    })
  }, [runBusy, templateForm, reloadCore])

  const handleDeleteTemplate = useCallback(
    async (id: number) => {
      await runBusy(async () => {
        await deleteSmsTemplate(id)
        setNotice('템플릿을 삭제했습니다.')
        await reloadCore()
      })
    },
    [runBusy, reloadCore],
  )

  const handleAddOptOut = useCallback(async () => {
    await runBusy(async () => {
      await addSmsOptOut(optOutForm)
      setOptOutForm({ phone: '', reason: '' })
      setNotice('수신거부 번호를 등록했습니다.')
      await reloadCore()
    })
  }, [runBusy, optOutForm, reloadCore])

  const handleRemoveOptOut = useCallback(
    async (id: number) => {
      await runBusy(async () => {
        await removeSmsOptOut(id)
        setNotice('수신거부 번호를 삭제했습니다.')
        await reloadCore()
      })
    },
    [runBusy, reloadCore],
  )

  const sendByteInfo = useMemo(
    () => ({
      bytes: estimateSmsBytes(sendForm.message),
      type: detectSmsType(sendForm.message),
    }),
    [sendForm.message],
  )

  const bulkByteInfo = useMemo(
    () => ({
      bytes: estimateSmsBytes(bulkForm.message),
      type: detectSmsType(bulkForm.message),
    }),
    [bulkForm.message],
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
    sendByteInfo,
    bulkByteInfo,
    reloadCore,
    handleSaveSettings,
    handleDeleteSettings,
    handleRegisterSender,
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

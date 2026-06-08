import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import FileUploader from '../../../../components/common/FileUploader'
import { useConfirmDialog } from '../../../../components/dialog'
import { useAuth } from '../../../auth/AuthProvider'
import { useInsurerNewsForm } from '../../../insurer-news/hooks/useInsurerNewsForm'
import {
  createCustomerNews,
  deleteCustomerNews,
  listAgentCustomerNews,
  listLinkedCustomers,
  updateCustomerNews,
  type AgentCustomerNewsItem,
  type LinkedCustomerItem,
} from '../../api/claimRequestsApi'
import {
  uploadCustomerNewsMessageAttachments,
  validateCustomerNewsMessageFileForUpload,
  type CustomerNewsMessageAttachmentDraft,
} from '../../model/customerNewsMessageAttachmentUpload'
import { salutationHonorific } from '../../utils/personalMessageLabels'
import ClaimRequestsPersonalMobileView from './ClaimRequestsPersonalMobileView'

function parsePositiveInt(raw: string | null | undefined): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

function formatDateTime(iso: string | null): string {
  if (!iso) {
    return '—'
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function ClaimRequestsPersonalMobileStandalone() {
  const { token } = useAuth()
  const { confirm, confirmDialog } = useConfirmDialog()
  const { customerId: customerIdParam } = useParams<{ customerId?: string }>()
  const [searchParams] = useSearchParams()
  const activeCustomerId = useMemo(() => {
    const fromQuery = parsePositiveInt(searchParams.get('customerId'))
    if (fromQuery != null) {
      return fromQuery
    }
    return parsePositiveInt(customerIdParam ?? null)
  }, [customerIdParam, searchParams])

  const [linkedCustomers, setLinkedCustomers] = useState<LinkedCustomerItem[]>([])
  const [resolvedCustomerName, setResolvedCustomerName] = useState('')
  const [history, setHistory] = useState<AgentCustomerNewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [uploadBusyText, setUploadBusyText] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const form = useInsurerNewsForm(null)

  const targetCustomer = useMemo(
    () => linkedCustomers.find((item) => item.customerId === activeCustomerId) ?? null,
    [activeCustomerId, linkedCustomers],
  )

  const honorific = useMemo(
    () => salutationHonorific(resolvedCustomerName || targetCustomer?.customerName),
    [resolvedCustomerName, targetCustomer],
  )

  const loadLinkedCustomers = useCallback(async () => {
    if (!token) {
      return
    }
    try {
      const customers = await listLinkedCustomers(token)
      setLinkedCustomers(customers)
    } catch {
      setLinkedCustomers([])
    }
  }, [token])

  const loadHistory = useCallback(async () => {
    if (!token || !activeCustomerId) {
      setHistory([])
      return
    }
    setLoading(true)
    try {
      const personal = await listAgentCustomerNews(token, {
        scope: 'personal',
        targetCustomerId: activeCustomerId,
      })
      setHistory(personal)
      const nameRow = personal.find((r) => r.targetCustomerName?.trim())
      if (nameRow?.targetCustomerName?.trim()) {
        setResolvedCustomerName(nameRow.targetCustomerName.trim())
      }
    } catch (loadError) {
      setHistory([])
      setError(loadError instanceof Error ? loadError.message : '개인메시지를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [activeCustomerId, token])

  useEffect(() => {
    void loadLinkedCustomers()
  }, [loadLinkedCustomers])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    form.setBodyText('')
    form.replaceAttachments([])
    setResult('')
    setError('')
    setDeletingId(null)
    setEditingId(null)
  }, [activeCustomerId, form.replaceAttachments, form.setBodyText])

  useEffect(() => {
    const fromLink = targetCustomer?.customerName?.trim()
    if (fromLink) {
      setResolvedCustomerName(fromLink)
    }
  }, [targetCustomer])

  const validateFile = useCallback((file: File): string | null => {
    return validateCustomerNewsMessageFileForUpload(file)
  }, [])

  const handleSendOrSave = async () => {
    if (!token) {
      return
    }
    if (!activeCustomerId) {
      setError('고객을 선택해 주세요.')
      return
    }

    if (editingId) {
      const content = form.bodyText.trim()
      if (!content) {
        setError('개인메시지 내용을 입력해 주세요.')
        return
      }
      setActionBusy(true)
      setError('')
      setResult('')
      try {
        await updateCustomerNews(token, editingId, {
          title: honorific,
          content,
          sendPush: true,
        })
        setResult('개인메시지를 저장했습니다.')
        setEditingId(null)
        form.setBodyText('')
        await loadHistory()
      } catch (sendError) {
        setError(sendError instanceof Error ? sendError.message : '처리에 실패했습니다.')
      } finally {
        setActionBusy(false)
      }
      return
    }

    if (!form.bodyText.trim() && form.attachments.length === 0) {
      setError('개인메시지 내용 또는 첨부파일을 추가해 주세요.')
      return
    }

    setActionBusy(true)
    setError('')
    setResult('')
    setUploadBusyText(form.attachments.length > 0 ? '파일 업로드 중…' : null)
    try {
      const uploaded = await uploadCustomerNewsMessageAttachments(
        token,
        form.attachments as CustomerNewsMessageAttachmentDraft[],
        activeCustomerId,
      )
      form.replaceAttachments(uploaded as Parameters<typeof form.replaceAttachments>[0])
      if (uploaded.some((row) => row.status === 'failed')) {
        setError('첨부파일 업로드에 실패했습니다. 파일을 다시 선택해 주세요.')
        return
      }
      const attachments = uploaded
        .filter((row): row is CustomerNewsMessageAttachmentDraft & { cdnUrl: string; objectKey: string } =>
          Boolean(row.cdnUrl && row.objectKey),
        )
        .map((row, index) => ({
          kind: row.kind,
          url: row.cdnUrl,
          objectKey: row.objectKey,
          fileName: row.file.name,
          mimeType: row.mimeType ?? row.file.type ?? 'application/octet-stream',
          size: row.sizeBytes ?? row.file.size,
          sortOrder: index,
        }))
      setUploadBusyText('개인메시지 발송 중…')
      await createCustomerNews(token, {
        title: honorific,
        content: form.bodyText.trim(),
        scope: 'personal',
        targetCustomerId: activeCustomerId,
        sendPush: true,
        attachments,
      })
      setResult('개인메시지 발송했습니다.')
      form.setBodyText('')
      form.replaceAttachments([])
      await loadHistory()
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '처리에 실패했습니다.')
    } finally {
      setUploadBusyText(null)
      setActionBusy(false)
    }
  }

  const handleStartEdit = (item: AgentCustomerNewsItem) => {
    setEditingId(item.id)
    form.setBodyText(String(item.content ?? ''))
    form.replaceAttachments([])
    setError('')
    setResult('')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    form.setBodyText('')
    form.replaceAttachments([])
    setError('')
  }

  const handleDeleteMessage = async (item: AgentCustomerNewsItem) => {
    if (!token) {
      return
    }
    const ok = await confirm({
      title: '개인메시지 삭제',
      message: '이 개인메시지를 삭제할까요? 고객앱에서도 더 이상 보이지 않습니다.',
      tone: 'danger',
      confirmLabel: '삭제',
    })
    if (!ok) {
      return
    }
    setDeletingId(item.id)
    setError('')
    setResult('')
    try {
      await deleteCustomerNews(token, item.id, { targetCustomerId: item.targetCustomerId ?? activeCustomerId })
      setHistory((prev) => prev.filter((row) => row.id !== item.id))
      setResult('소식지를 삭제했습니다.')
      if (editingId === item.id) {
        setEditingId(null)
        form.setBodyText('')
        form.replaceAttachments([])
      }
      await loadHistory()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '소식지 삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  const hasUploadingAttachment = form.attachments.some(
    (row) => 'status' in row && row.status === 'uploading',
  )

  return (
    <>
      <ClaimRequestsPersonalMobileView
        targetHeading={honorific}
        targetCustomer={targetCustomer}
        targetCustomerId={activeCustomerId}
        message={form.bodyText}
        draftAttachments={form.attachments as CustomerNewsMessageAttachmentDraft[]}
        uploadBusyText={uploadBusyText}
        history={history}
        loading={loading}
        actionBusy={actionBusy}
        hasUploadingAttachment={hasUploadingAttachment}
        deletingId={deletingId}
        editingId={editingId}
        resultMessage={result}
        errorMessage={error}
        onMessageChange={form.setBodyText}
        onAddAttachments={form.addAttachments}
        onRemoveAttachment={form.removeAttachment}
        validateFile={validateFile}
        onInvalidFiles={(message) => setError(message)}
        onSend={() => void handleSendOrSave()}
        onStartEdit={(item) => handleStartEdit(item)}
        onCancelEdit={handleCancelEdit}
        onDeleteMessage={(item) => void handleDeleteMessage(item)}
        formatDateTime={formatDateTime}
      />
      {confirmDialog}
    </>
  )
}

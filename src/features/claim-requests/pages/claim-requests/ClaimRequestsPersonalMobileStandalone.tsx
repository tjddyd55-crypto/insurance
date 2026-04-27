import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import {
  createCustomerNews,
  deleteCustomerNews,
  listAgentCustomerNews,
  listLinkedCustomers,
  type AgentCustomerNewsItem,
  type LinkedCustomerItem,
} from '../../api/claimRequestsApi'
import ClaimRequestsPersonalMobileView from './ClaimRequestsPersonalMobileView'

function parsePositiveInt(raw: string | null): number | null {
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
  const [history, setHistory] = useState<AgentCustomerNewsItem[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')

  const targetCustomer = useMemo(
    () => linkedCustomers.find((item) => item.customerId === activeCustomerId) ?? null,
    [activeCustomerId, linkedCustomers],
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
    setMessage('')
    setResult('')
    setError('')
    setDeletingId(null)
  }, [activeCustomerId])

  const handleSend = async () => {
    if (!token) {
      return
    }
    if (!activeCustomerId) {
      setError('고객을 선택해 주세요.')
      return
    }
    const content = message.trim()
    if (!content) {
      setError('개인메시지 내용을 입력해 주세요.')
      return
    }
    setActionBusy(true)
    setError('')
    setResult('')
    try {
      const title = targetCustomer ? `${targetCustomer.customerName} 고객님께` : '개인메시지'
      const created = await createCustomerNews(token, {
        title,
        content,
        scope: 'personal',
        targetCustomerId: activeCustomerId,
        sendPush: true,
      })
      setResult(`개인메시지 발송 완료: ${created.id}`)
      setMessage('')
      await loadHistory()
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '개인메시지 발송에 실패했습니다.')
    } finally {
      setActionBusy(false)
    }
  }

  const handleDeleteMessage = async (item: AgentCustomerNewsItem) => {
    if (!token) {
      return
    }
    if (
      !window.confirm(
        '이 개인 소식지를 완전히 삭제할까요? 고객 앱에서도 보이지 않으며 복구할 수 없습니다.',
      )
    ) {
      return
    }
    setDeletingId(item.id)
    setError('')
    setResult('')
    try {
      await deleteCustomerNews(token, item.id, { targetCustomerId: item.targetCustomerId ?? activeCustomerId })
      setHistory((prev) => prev.filter((row) => row.id !== item.id))
      setResult('소식지를 삭제했습니다.')
      await loadHistory()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '소식지 삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <ClaimRequestsPersonalMobileView
      targetCustomer={targetCustomer}
      targetCustomerId={activeCustomerId}
      message={message}
      history={history}
      loading={loading}
      actionBusy={actionBusy}
      deletingId={deletingId}
      resultMessage={result}
      errorMessage={error}
      onMessageChange={setMessage}
      onSend={() => void handleSend()}
      onDeleteMessage={(item) => void handleDeleteMessage(item)}
      formatDateTime={formatDateTime}
    />
  )
}

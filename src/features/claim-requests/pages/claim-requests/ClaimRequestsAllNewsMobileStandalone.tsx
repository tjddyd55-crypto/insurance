import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../auth/AuthProvider'
import {
  createCustomerNews,
  deleteCustomerNews,
  listAgentCustomerNews,
  type AgentCustomerNewsItem,
} from '../../api/claimRequestsApi'
import ClaimRequestsAllNewsMobileView from './ClaimRequestsAllNewsMobileView'

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

export default function ClaimRequestsAllNewsMobileStandalone() {
  const { token } = useAuth()
  const [history, setHistory] = useState<AgentCustomerNewsItem[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')

  const loadHistory = useCallback(async () => {
    if (!token) {
      setHistory([])
      return
    }
    setLoading(true)
    try {
      const rows = await listAgentCustomerNews(token, { scope: 'all' })
      setHistory(rows)
    } catch (loadError) {
      setHistory([])
      setError(loadError instanceof Error ? loadError.message : '전체소식지를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const handleSend = async () => {
    if (!token) {
      return
    }
    const nextTitle = title.trim()
    const nextContent = content.trim()
    if (!nextTitle) {
      setError('전체소식지 제목을 입력해 주세요.')
      return
    }
    if (!nextContent) {
      setError('전체소식지 내용을 입력해 주세요.')
      return
    }
    setActionBusy(true)
    setError('')
    setResult('')
    try {
      const created = await createCustomerNews(token, {
        title: nextTitle,
        content: nextContent,
        scope: 'all',
        targetCustomerId: null,
        sendPush: true,
      })
      setResult(`전체소식지 발송 완료: ${created.id}`)
      setTitle('')
      setContent('')
      await loadHistory()
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '전체소식지 발송에 실패했습니다.')
    } finally {
      setActionBusy(false)
    }
  }

  const handleDeleteNews = async (item: AgentCustomerNewsItem) => {
    if (!token) {
      return
    }
    if (!window.confirm('이 전체소식지를 삭제하시겠습니까? 고객앱에서도 더 이상 보이지 않습니다.')) {
      return
    }
    setDeletingId(item.id)
    setError('')
    setResult('')
    try {
      await deleteCustomerNews(token, item.id)
      setHistory((prev) => prev.filter((row) => row.id !== item.id))
      setResult('전체소식지를 삭제했습니다.')
      await loadHistory()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '전체소식지 삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <ClaimRequestsAllNewsMobileView
      title={title}
      content={content}
      history={history}
      loading={loading}
      actionBusy={actionBusy}
      deletingId={deletingId}
      resultMessage={result}
      errorMessage={error}
      onTitleChange={setTitle}
      onContentChange={setContent}
      onSend={() => void handleSend()}
      onDeleteNews={(item) => void handleDeleteNews(item)}
      formatDateTime={formatDateTime}
    />
  )
}

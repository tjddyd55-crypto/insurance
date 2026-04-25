import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { deleteStorageFile, downloadStorageFile, openStorageFile } from '../api/storageApi'
import {
  getStorageUsageBreakdown,
  type StorageUsageBreakdown,
  type StorageUsageItem,
} from '../api/storageUsageApi'

type StorageUsageManagerProps = {
  token: string
  onStorageChanged?: () => void
}

function emptyBreakdown(): StorageUsageBreakdown {
  return {
    items: [],
    summary: [
      { source: 'personal-storage', label: '내 파일', count: 0, size: 0 },
      { source: 'customer-storage', label: '고객 파일', count: 0, size: 0 },
      { source: 'claim-file', label: '청구 첨부', count: 0, size: 0 },
      { source: 'customer-news', label: '소식지 첨부', count: 0, size: 0 },
    ],
    totalCount: 0,
    totalSize: 0,
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 KB'
  }
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }
  return `${Math.ceil(bytes / 1024)} KB`
}

function formatDate(iso: string | null): string {
  if (!iso) {
    return '—'
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return String(iso).slice(0, 10) || '—'
  }
  return date.toLocaleDateString('ko-KR')
}

export default function StorageUsageManager({ token, onStorageChanged }: StorageUsageManagerProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [breakdown, setBreakdown] = useState<StorageUsageBreakdown>(() => emptyBreakdown())

  const loadUsage = useCallback(async () => {
    if (!token?.trim()) {
      return
    }
    setLoading(true)
    setError('')
    try {
      const nextBreakdown = await getStorageUsageBreakdown(token)
      setBreakdown(nextBreakdown)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '용량 사용처를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token])

  const handleDelete = useCallback(async (item: StorageUsageItem) => {
    if (!token?.trim() || !item.storageFileId || !item.canDeleteDirectly) {
      return
    }
    const ok = window.confirm(`"${item.fileName}" 파일을 삭제할까요?`)
    if (!ok) {
      return
    }
    setDeletingId(item.id)
    setError('')
    try {
      await deleteStorageFile(token, item.storageFileId)
      setBreakdown((prev) => {
        const items = prev.items.filter((row) => row.id !== item.id)
        const totalSize = items.reduce((sum, row) => sum + (Number(row.size) || 0), 0)
        const summary = prev.summary.map((group) => {
          const groupItems = items.filter((row) => row.source === group.source)
          return {
            ...group,
            count: groupItems.length,
            size: groupItems.reduce((sum, row) => sum + (Number(row.size) || 0), 0),
          }
        })
        return { items, summary, totalCount: items.length, totalSize }
      })
      onStorageChanged?.()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '파일 삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }, [onStorageChanged, token])

  const handleOpen = useCallback(async (item: StorageUsageItem) => {
    if (!token?.trim() || !item.storageFileId) {
      return
    }
    try {
      await openStorageFile(token, item.storageFileId)
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : '파일 열기에 실패했습니다.')
    }
  }, [token])

  const handleDownload = useCallback(async (item: StorageUsageItem) => {
    if (!token?.trim() || !item.storageFileId) {
      return
    }
    try {
      await downloadStorageFile(token, item.storageFileId)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : '다운로드에 실패했습니다.')
    }
  }, [token])

  const handleGoSource = useCallback((item: StorageUsageItem) => {
    if (item.source === 'customer-storage' && item.customerId) {
      navigate(`/customers/${item.customerId}/files`)
      return
    }
    if (item.source === 'claim-file' && item.customerId && item.claimRequestId) {
      navigate(`/customers/${item.customerId}/claim-requests?claimId=${item.claimRequestId}`)
      return
    }
    if (item.source === 'customer-news') {
      navigate(`/claim-requests?claimTab=${item.newsScope === 'personal' ? 'news-personal' : 'news-all'}`)
      return
    }
    navigate('/storage')
  }, [navigate])

  return (
    <section className="storage-usage-manager">
      <div className="storage-usage-manager__header">
        <div>
          <h2>전체 용량 사용처</h2>
          <p>내 파일, 고객 파일, 청구 첨부, 고객 소식지 첨부가 어디에 얼마나 쓰이는지 확인합니다.</p>
        </div>
        <div className="storage-usage-manager__actions">
          <FormButton
            htmlType="button"
            variant="secondary"
            onClick={() => {
              setOpen((value) => !value)
              if (!open && breakdown.items.length === 0) {
                void loadUsage()
              }
            }}
          >
            {open ? '접기' : '사용처 보기'}
          </FormButton>
          {open ? (
            <FormButton htmlType="button" variant="secondary" onClick={() => void loadUsage()} loading={loading}>
              새로고침
            </FormButton>
          ) : null}
        </div>
      </div>

      {open ? (
        <>
          {error ? <p className="storage-usage-manager__error">{error}</p> : null}
          <div className="storage-usage-manager__summary">
            <div className="storage-usage-manager__summary-card storage-usage-manager__summary-card--total">
              <span>분석된 파일</span>
              <strong>{breakdown.totalCount}개</strong>
              <small>{formatBytes(breakdown.totalSize)}</small>
            </div>
            {breakdown.summary.map((group) => (
              <div key={group.source} className="storage-usage-manager__summary-card">
                <span>{group.label}</span>
                <strong>{group.count}개</strong>
                <small>{formatBytes(group.size)}</small>
              </div>
            ))}
          </div>

          {loading ? <div className="storage-usage-manager__empty">용량 사용처를 불러오는 중…</div> : null}
          {!loading && breakdown.items.length === 0 ? <div className="storage-usage-manager__empty">표시할 파일이 없습니다.</div> : null}
          {!loading && breakdown.items.length > 0 ? (
            <div className="storage-usage-manager__list">
              {breakdown.items.map((item) => (
                <article key={item.id} className="storage-usage-manager__item">
                  <div className="storage-usage-manager__item-main">
                    <span className={`storage-usage-manager__badge storage-usage-manager__badge--${item.source}`}>{item.sourceLabel}</span>
                    <strong>{item.fileName}</strong>
                    <p>{item.locationLabel}</p>
                    <small>{formatBytes(item.size)} · {formatDate(item.createdAt)}</small>
                  </div>
                  <div className="storage-usage-manager__item-actions">
                    {item.storageFileId ? (
                      <>
                        <button type="button" onClick={() => void handleOpen(item)}>열기</button>
                        <button type="button" onClick={() => void handleDownload(item)}>다운</button>
                      </>
                    ) : null}
                    <button type="button" onClick={() => handleGoSource(item)}>원본관리</button>
                    {item.canDeleteDirectly ? (
                      <button
                        type="button"
                        className="storage-usage-manager__danger"
                        disabled={deletingId === item.id}
                        onClick={() => void handleDelete(item)}
                      >
                        삭제
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

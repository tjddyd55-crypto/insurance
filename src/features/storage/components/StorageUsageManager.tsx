import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { listCustomers } from '../../customers/api/customersApi'
import {
  getClaimRequestDetail,
  listAgentCustomerNews,
  listClaimRequests,
  type AgentCustomerNewsItem,
} from '../../claim-requests/api/claimRequestsApi'
import {
  deleteStorageFile,
  downloadStorageFile,
  listStorageFiles,
  openStorageFile,
  type StorageFileRow,
} from '../api/storageApi'

type UsageSource = 'personal-storage' | 'customer-storage' | 'claim-file' | 'customer-news'

type UsageItem = {
  id: string
  source: UsageSource
  sourceLabel: string
  fileName: string
  size: number
  createdAt: string | null
  locationLabel: string
  storageFileId?: number
  customerId?: number | null
  customerName?: string
  claimRequestId?: number
  newsId?: string
  newsScope?: 'all' | 'personal'
  canDeleteDirectly: boolean
}

type UsageSummary = {
  source: UsageSource
  label: string
  count: number
  size: number
}

type StorageUsageManagerProps = {
  token: string
  onStorageChanged?: () => void
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

function fileSizeOf(row: StorageFileRow): number {
  return Number(row.fileSize ?? 0) || 0
}

function mapStorageFile(row: StorageFileRow, source: UsageSource, customerName?: string): UsageItem {
  const isCustomer = source === 'customer-storage'
  return {
    id: `${source}:${row.id}`,
    source,
    sourceLabel: isCustomer ? '고객 파일' : '내 파일',
    fileName: row.displayName || row.fileName || row.originalName || `파일 #${row.id}`,
    size: fileSizeOf(row),
    createdAt: row.createdAt,
    locationLabel: isCustomer ? `${customerName || `고객 #${row.customerId}`} · 고객 파일` : '내 저장공간',
    storageFileId: row.id,
    customerId: row.customerId,
    customerName,
    canDeleteDirectly: true,
  }
}

function mapClaimFile(params: {
  requestId: number
  customerId: number
  customerName: string
  file: { id: number; fileName: string; fileSize: number; uploadedAt: string | null }
}): UsageItem {
  return {
    id: `claim-file:${params.file.id}`,
    source: 'claim-file',
    sourceLabel: '청구 첨부',
    fileName: params.file.fileName || `청구파일 #${params.file.id}`,
    size: Number(params.file.fileSize ?? 0) || 0,
    createdAt: params.file.uploadedAt,
    locationLabel: `${params.customerName || `고객 #${params.customerId}`} · 청구 #${params.requestId}`,
    customerId: params.customerId,
    customerName: params.customerName,
    claimRequestId: params.requestId,
    canDeleteDirectly: false,
  }
}

function mapNewsAttachments(news: AgentCustomerNewsItem): UsageItem[] {
  const scopeLabel = news.scope === 'personal' ? '개인 소식지' : '전체 소식지'
  return (news.attachments ?? []).map((file) => ({
    id: `customer-news:${news.id}:${file.id}`,
    source: 'customer-news' as const,
    sourceLabel: '소식지 첨부',
    fileName: file.fileName || `첨부 #${file.id}`,
    size: Number(file.size ?? 0) || 0,
    createdAt: news.updatedAt,
    locationLabel: news.targetCustomerName ? `${news.targetCustomerName} · ${scopeLabel}` : scopeLabel,
    customerId: news.targetCustomerId,
    customerName: news.targetCustomerName,
    newsId: news.id,
    newsScope: news.scope,
    canDeleteDirectly: false,
  }))
}

export default function StorageUsageManager({ token, onStorageChanged }: StorageUsageManagerProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [items, setItems] = useState<UsageItem[]>([])

  const summary = useMemo<UsageSummary[]>(() => {
    const groups: UsageSummary[] = [
      { source: 'personal-storage', label: '내 파일', count: 0, size: 0 },
      { source: 'customer-storage', label: '고객 파일', count: 0, size: 0 },
      { source: 'claim-file', label: '청구 첨부', count: 0, size: 0 },
      { source: 'customer-news', label: '소식지 첨부', count: 0, size: 0 },
    ]
    const bySource = new Map(groups.map((group) => [group.source, group]))
    for (const item of items) {
      const group = bySource.get(item.source)
      if (!group) {
        continue
      }
      group.count += 1
      group.size += item.size
    }
    return groups
  }, [items])

  const totalSize = useMemo(() => items.reduce((sum, item) => sum + item.size, 0), [items])

  const loadUsage = useCallback(async () => {
    if (!token?.trim()) {
      return
    }
    setLoading(true)
    setError('')
    try {
      const nextItems: UsageItem[] = []

      const personalFiles = await listStorageFiles(token, { customerId: null })
      nextItems.push(...personalFiles.map((file) => mapStorageFile(file, 'personal-storage')))

      const { customers } = await listCustomers(token, 500)
      const customerMap = new Map(customers.map((customer) => [customer.id, customer.name]))
      const customerFileResults = await Promise.allSettled(
        customers.map(async (customer) => {
          const files = await listStorageFiles(token, { customerId: customer.id })
          return files.map((file) => mapStorageFile(file, 'customer-storage', customer.name))
        }),
      )
      for (const result of customerFileResults) {
        if (result.status === 'fulfilled') {
          nextItems.push(...result.value)
        }
      }

      const claims = await listClaimRequests(token, { page: 1, pageSize: 100 })
      const claimDetails = await Promise.allSettled(
        claims.rows.map((row) => getClaimRequestDetail(token, row.id)),
      )
      for (const result of claimDetails) {
        if (result.status !== 'fulfilled') {
          continue
        }
        const detail = result.value
        for (const file of detail.files) {
          nextItems.push(mapClaimFile({
            requestId: detail.id,
            customerId: detail.customerId,
            customerName: detail.customerName || customerMap.get(detail.customerId) || '',
            file,
          }))
        }
      }

      const [allNews, personalNews] = await Promise.all([
        listAgentCustomerNews(token, { scope: 'all' }).catch(() => []),
        listAgentCustomerNews(token, { scope: 'personal' }).catch(() => []),
      ])
      for (const news of [...allNews, ...personalNews]) {
        nextItems.push(...mapNewsAttachments(news))
      }

      nextItems.sort((a, b) => b.size - a.size || String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
      setItems(nextItems)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '용량 사용처를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token])

  const handleDelete = useCallback(async (item: UsageItem) => {
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
      setItems((prev) => prev.filter((row) => row.id !== item.id))
      onStorageChanged?.()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '파일 삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }, [onStorageChanged, token])

  const handleOpen = useCallback(async (item: UsageItem) => {
    if (!token?.trim()) {
      return
    }
    if (item.storageFileId) {
      try {
        await openStorageFile(token, item.storageFileId)
      } catch (openError) {
        setError(openError instanceof Error ? openError.message : '파일 열기에 실패했습니다.')
      }
    }
  }, [token])

  const handleDownload = useCallback(async (item: UsageItem) => {
    if (!token?.trim() || !item.storageFileId) {
      return
    }
    try {
      await downloadStorageFile(token, item.storageFileId)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : '다운로드에 실패했습니다.')
    }
  }, [token])

  const handleGoSource = useCallback((item: UsageItem) => {
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
              if (!open && items.length === 0) {
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
              <strong>{items.length}개</strong>
              <small>{formatBytes(totalSize)}</small>
            </div>
            {summary.map((group) => (
              <div key={group.source} className="storage-usage-manager__summary-card">
                <span>{group.label}</span>
                <strong>{group.count}개</strong>
                <small>{formatBytes(group.size)}</small>
              </div>
            ))}
          </div>

          {loading ? <div className="storage-usage-manager__empty">용량 사용처를 불러오는 중…</div> : null}
          {!loading && items.length === 0 ? <div className="storage-usage-manager__empty">표시할 파일이 없습니다.</div> : null}
          {!loading && items.length > 0 ? (
            <div className="storage-usage-manager__list">
              {items.map((item) => (
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

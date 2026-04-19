import { useCallback, useEffect, useMemo, useState } from 'react'
import FileUploader from '../../../components/common/FileUploader'
import { StatusMessage } from '../../../components/feedback'
import { FormButton, FormInput, FormSelect, FormTextarea } from '../../../components/form'
import useIsMobile from '../../../hooks/useIsMobile'
import { NewsletterList } from '../../insurer-news/components/NewsletterList'
import { uploadNewsletterAttachments } from '../../insurer-news/services/insurerNews.service'
import type { LocalAttachmentDraft } from '../../insurer-news/types'
import { useInsurerNewsForm } from '../../insurer-news/hooks/useInsurerNewsForm'
import type { NewsletterItem } from '../../insurer-news/types'
import { validateInsurerNewsFile } from '../../insurer-news/utils/validateInsurerNewsFile'
import { useAuth } from '../../auth/AuthProvider'
import ClaimRequestsPageMobileView from './claim-requests/ClaimRequestsPageMobileView'
import ClaimRequestsPagePCView from './claim-requests/ClaimRequestsPagePCView'
import {
  createCustomerAppLink,
  createCustomerNews,
  getClaimRequestDetail,
  listAgentCustomerNews,
  listClaimRequests,
  listLinkedCustomers,
  type AgentCustomerNewsItem,
  type ClaimRequestDetail,
  type ClaimRequestListItem,
  type ClaimRequestStatus,
  type LinkedCustomerItem,
  updateClaimRequestStatus,
} from '../api/claimRequestsApi'

const STATUS_OPTIONS: Array<{ value: ClaimRequestStatus; label: string }> = [
  { value: 'requested', label: '요청됨' },
  { value: 'processing', label: '처리중' },
  { value: 'done', label: '완료' },
  { value: 'rejected', label: '반려' },
  { value: 'canceled', label: '취소' },
]

const ATTACHMENT_STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  uploading: '업로드 중',
  completed: '완료',
  failed: '실패',
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

function statusLabel(status: ClaimRequestStatus): string {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status
}

export default function ClaimRequestsPage() {
  const isMobile = useIsMobile()
  const { token } = useAuth()
  const [activeTab, setActiveTab] = useState<'claims' | 'news-all' | 'news-personal'>('claims')
  const [rows, setRows] = useState<ClaimRequestListItem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ClaimRequestDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusMemo, setStatusMemo] = useState('')
  const [statusTarget, setStatusTarget] = useState<ClaimRequestStatus>('processing')
  const [createdLink, setCreatedLink] = useState('')
  const [createdCode, setCreatedCode] = useState('')
  const [copyResult, setCopyResult] = useState('')
  const [newsTitle, setNewsTitle] = useState('')
  const [newsAllSubTab, setNewsAllSubTab] = useState<'list' | 'upload'>('list')
  const [newsResult, setNewsResult] = useState('')
  const [newsUploadError, setNewsUploadError] = useState('')
  const [newsUploadBusy, setNewsUploadBusy] = useState<string | null>(null)
  const [linkedCustomers, setLinkedCustomers] = useState<LinkedCustomerItem[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [personalNewsContent, setPersonalNewsContent] = useState('')
  const [newsHistoryAll, setNewsHistoryAll] = useState<AgentCustomerNewsItem[]>([])
  const [newsHistoryPersonal, setNewsHistoryPersonal] = useState<AgentCustomerNewsItem[]>([])
  const [actionBusy, setActionBusy] = useState(false)
  const allNewsForm = useInsurerNewsForm(null)

  const selectedRow = useMemo(() => rows.find((item) => item.id === selectedId) ?? null, [rows, selectedId])
  const allNewsCards = useMemo<NewsletterItem[]>(
    () =>
      newsHistoryAll.map((item) => ({
        id: item.id,
        gaCode: 'customer-news',
        insurerCode: 'customer-news',
        insurerName: '전체소식지',
        insurerSlug: 'all',
        title: item.title,
        summary: item.content,
        heroImageUrl: item.heroImageUrl ?? null,
        publishedAt: item.updatedAt ?? new Date().toISOString(),
        status: 'PUBLISHED',
        hasImages: Boolean(item.attachments?.some((attachment) => attachment.kind === 'image')),
        hasPdf: Boolean(item.attachments?.some((attachment) => attachment.kind === 'file')),
        hasTextBody: Boolean(item.content?.trim()),
      })),
    [newsHistoryAll],
  )
  const personalNewsCards = useMemo<NewsletterItem[]>(
    () =>
      newsHistoryPersonal.map((item) => ({
        id: item.id,
        gaCode: 'customer-news',
        insurerCode: 'customer-news-personal',
        insurerName: '개인소식지',
        insurerSlug: 'personal',
        title: item.title,
        summary: item.content,
        heroImageUrl: item.heroImageUrl ?? null,
        publishedAt: item.updatedAt ?? new Date().toISOString(),
        status: 'PUBLISHED',
        hasImages: Boolean(item.attachments?.some((attachment) => attachment.kind === 'image')),
        hasPdf: Boolean(item.attachments?.some((attachment) => attachment.kind === 'file')),
        hasTextBody: Boolean(item.content?.trim()),
      })),
    [newsHistoryPersonal],
  )

  const loadList = useCallback(async () => {
    if (!token) {
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await listClaimRequests(token, { page: 1, pageSize: 50 })
      if (!res) {
        console.error('API 응답 이상', res)
        setRows([])
        setSelectedId(null)
        setDetail(null)
        return
      }
      const rows = res.rows || []
      setRows(rows)
      if (rows.length > 0) {
        setSelectedId((prev) => prev ?? rows[0].id)
      } else {
        setSelectedId(null)
        setDetail(null)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '요청 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token])

  const loadDetail = useCallback(async () => {
    if (!token || selectedId == null) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    try {
      const response = await getClaimRequestDetail(token, selectedId)
      setDetail(response)
      setStatusTarget(response.status)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '요청 상세를 불러오지 못했습니다.')
    } finally {
      setDetailLoading(false)
    }
  }, [token, selectedId])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const loadLinkedCustomers = useCallback(async () => {
    if (!token) {
      return
    }
    try {
      const customers = await listLinkedCustomers(token)
      setLinkedCustomers(customers)
      if (customers.length > 0) {
        setSelectedCustomerId((prev) => prev ?? customers[0].customerId)
      } else {
        setSelectedCustomerId(null)
      }
    } catch {
      // linked customers는 부가 기능이라 기존 화면을 막지 않는다.
    }
  }, [token])

  const loadNewsHistory = useCallback(
    async (targetCustomerId?: number | null) => {
      if (!token) {
        return
      }
      try {
        const all = await listAgentCustomerNews(token, { scope: 'all' })
        setNewsHistoryAll(all)
      } catch {
        setNewsHistoryAll([])
      }
      if (!targetCustomerId) {
        setNewsHistoryPersonal([])
        return
      }
      try {
        const personal = await listAgentCustomerNews(token, {
          scope: 'personal',
          targetCustomerId,
        })
        setNewsHistoryPersonal(personal)
      } catch {
        setNewsHistoryPersonal([])
      }
    },
    [token],
  )

  useEffect(() => {
    void loadLinkedCustomers()
  }, [loadLinkedCustomers])

  useEffect(() => {
    void loadNewsHistory(selectedCustomerId)
  }, [loadNewsHistory, selectedCustomerId])

  const handleCreateLink = async () => {
    if (!token) {
      return
    }
    setActionBusy(true)
    setCreatedLink('')
    setCreatedCode('')
    try {
      const res = await createCustomerAppLink(token)
      if (!res) {
        console.error('API 응답 이상', res)
        return
      }
      const linkUrl = res.universalUrl || ''
      if (!linkUrl) {
        console.error('API 응답 이상', res)
        setError('링크 응답 형식이 올바르지 않습니다.')
        return
      }
      setCreatedLink(linkUrl)
      setCreatedCode(String(res.agentCode ?? res.linkCode ?? '').trim())
      setError('')
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '링크 생성에 실패했습니다.')
    } finally {
      setActionBusy(false)
    }
  }

  const handleUpdateStatus = async () => {
    if (!token || selectedId == null || !detail) {
      return
    }
    setActionBusy(true)
    try {
      await updateClaimRequestStatus(token, selectedId, {
        status: statusTarget,
        memo: statusMemo.trim(),
      })
      setStatusMemo('')
      await loadList()
      await loadDetail()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '상태 변경에 실패했습니다.')
    } finally {
      setActionBusy(false)
    }
  }

  const validateNewsletterFile = useCallback((file: File): string | null => {
    const validated = validateInsurerNewsFile(file)
    return validated.ok ? null : validated.message
  }, [])

  const handleCreateNews = async () => {
    if (!token) {
      return
    }
    if (!newsTitle.trim() || !allNewsForm.bodyText.trim()) {
      setNewsUploadError('소식지 제목과 내용을 입력해 주세요.')
      return
    }
    setActionBusy(true)
    setNewsResult('')
    setNewsUploadError('')
    setNewsUploadBusy('파일 업로드 중...')
    try {
      const uploaded = await uploadNewsletterAttachments(token, allNewsForm.attachments, {
        presignInsurerCode: 'CUSTOMER_NEWS',
      })
      allNewsForm.replaceAttachments(uploaded)
      if (uploaded.some((row) => row.status === 'failed')) {
        setNewsUploadError('일부 파일 업로드에 실패했습니다. 실패 항목을 삭제하고 다시 시도해 주세요.')
        return
      }
      const attachments = uploaded
        .filter((row): row is LocalAttachmentDraft & { cdnUrl: string; objectKey: string } => Boolean(row.cdnUrl && row.objectKey))
        .map((row, index) => ({
          kind: row.kind,
          url: row.cdnUrl,
          objectKey: row.objectKey,
          fileName: row.file.name,
          mimeType: row.mimeType ?? row.file.type ?? 'application/octet-stream',
          size: row.sizeBytes ?? row.file.size,
          sortOrder: index,
        }))
      setNewsUploadBusy('소식지 저장 중...')
      const created = await createCustomerNews(token, {
        title: newsTitle.trim(),
        content: allNewsForm.bodyText.trim(),
        attachments,
        scope: 'all',
        sendPush: true,
      })
      setNewsResult(`고객 소식지 등록 완료: ${created.id}`)
      setNewsTitle('')
      allNewsForm.setBodyText('')
      allNewsForm.replaceAttachments([])
      await loadNewsHistory(selectedCustomerId)
      setError('')
      setNewsAllSubTab('list')
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '소식지 등록에 실패했습니다.')
    } finally {
      setNewsUploadBusy(null)
      setActionBusy(false)
    }
  }

  const handleCreatePersonalNews = async () => {
    if (!token) {
      return
    }
    if (!selectedCustomerId) {
      setError('개별소식지를 보낼 고객을 선택해 주세요.')
      return
    }
    if (!personalNewsContent.trim()) {
      setError('개별소식지 내용을 입력해 주세요.')
      return
    }
    setActionBusy(true)
    setNewsResult('')
    try {
      const customer = linkedCustomers.find((item) => item.customerId === selectedCustomerId)
      const title = customer ? `${customer.customerName} 고객님께` : '개별소식지'
      const created = await createCustomerNews(token, {
        title,
        content: personalNewsContent.trim(),
        scope: 'personal',
        targetCustomerId: selectedCustomerId,
        sendPush: true,
      })
      setNewsResult(`개별소식지 전송 완료: ${created.id}`)
      setPersonalNewsContent('')
      await loadNewsHistory(selectedCustomerId)
      setError('')
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '개별소식지 전송에 실패했습니다.')
    } finally {
      setActionBusy(false)
    }
  }

  const handleCopyText = useCallback(async (value: string, label: string) => {
    if (!value.trim()) {
      return
    }
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('clipboard API unavailable')
      }
      await navigator.clipboard.writeText(value)
      setCopyResult(`${label} 복사 완료`)
    } catch {
      setCopyResult(`${label} 복사 실패`)
    }
  }, [])

  const pageContent = (
    <>
      <div>
        <h1 className="text-lg font-semibold">청구 요청</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          고객앱 링크 생성, 청구 요청 확인/상태 변경, 고객 소식지 등록을 한 화면에서 관리합니다.
        </p>
      </div>

      <StatusMessage message={error} tone="error" />

      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2">
        <div className="flex flex-wrap gap-2">
          <FormButton
            htmlType="button"
            variant={activeTab === 'claims' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('claims')}
          >
            청구요청
          </FormButton>
          <FormButton
            htmlType="button"
            variant={activeTab === 'news-all' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('news-all')}
          >
            전체소식지업로드
          </FormButton>
          <FormButton
            htmlType="button"
            variant={activeTab === 'news-personal' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('news-personal')}
          >
            개별소식지업로드
          </FormButton>
        </div>
      </section>

      {activeTab === 'claims' ? (
        <>
          <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 space-y-3">
        <h2 className="text-sm font-semibold">고객 앱 링크 생성</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <FormButton htmlType="button" variant="primary" onClick={() => void handleCreateLink()} loading={actionBusy}>
            링크 생성
          </FormButton>
        </div>
        {createdLink ? (
          <div className="space-y-1">
            {createdCode ? (
              <>
                <div className="text-xs text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-primary)] mr-2">설계사 연결 코드</span>
                  생성 완료
                </div>
                <div className="flex items-center gap-2">
                  <FormInput className="w-full text-xs font-mono" value={createdCode} readOnly />
                  <FormButton
                    htmlType="button"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => void handleCopyText(createdCode, '코드')}
                  >
                    복사하기
                  </FormButton>
                </div>
              </>
            ) : null}
            <div className="text-xs text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--text-primary)] mr-2">연결 URL</span>
              생성 완료
            </div>
            <div className="flex items-center gap-2">
              <FormInput className="w-full text-xs" value={createdLink} readOnly />
              <FormButton
                htmlType="button"
                variant="secondary"
                className="shrink-0"
                onClick={() => void handleCopyText(createdLink, 'URL')}
              >
                복사하기
              </FormButton>
            </div>
            {copyResult ? <div className="text-xs text-[var(--text-secondary)]">{copyResult}</div> : null}
          </div>
        ) : null}
      </section>

          <section className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-3">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2">
          <div className="text-sm font-semibold px-2 py-1">요청 목록</div>
          {loading ? <div className="px-2 py-3 text-sm text-[var(--text-secondary)]">불러오는 중…</div> : null}
          {!loading && rows.length === 0 ? (
            <div className="px-2 py-3 text-sm text-[var(--text-secondary)]">청구 요청이 없습니다.</div>
          ) : null}
          <div className="space-y-1">
            {rows.map((item) => {
              const active = item.id === selectedId
              const senderName = item.requesterName || item.customerName
              return (
                <FormButton
                  key={item.id}
                  htmlType="button"
                  className={`w-full text-left rounded-lg px-2 py-2 border ${
                    active ? 'border-blue-500 bg-blue-50/60' : 'border-transparent hover:border-[var(--border-default)]'
                  }`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="text-sm font-medium">{senderName}</div>
                  {item.requesterName ? (
                    <div className="text-[11px] text-[var(--text-secondary)] mt-1 truncate">
                      요청자: {item.requesterName} / {item.requesterBirthDate} / {item.requesterPhone}
                    </div>
                  ) : null}
                  <div className="text-[11px] text-[var(--text-secondary)] mt-1 truncate">
                    연결고객: {item.customerName}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {statusLabel(item.status)} · 첨부 {item.fileCount}개 · {formatDateTime(item.submittedAt)}
                  </div>
                  {item.deviceId ? (
                    <div className="text-[11px] text-[var(--text-secondary)] mt-1 truncate">설치자 기기: {item.deviceId}</div>
                  ) : null}
                  {item.title ? <div className="text-xs mt-1 truncate">{item.title}</div> : null}
                </FormButton>
              )
            })}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 space-y-3">
          {detailLoading ? <div className="text-sm text-[var(--text-secondary)]">상세 불러오는 중…</div> : null}
          {!detailLoading && !detail ? (
            <div className="text-sm text-[var(--text-secondary)]">요청을 선택해 주세요.</div>
          ) : null}
          {detail ? (
            <>
              <div>
                {(() => {
                  const senderName = detail.requesterName || detail.customerName
                  return (
                    <div className="text-sm font-semibold">
                      #{detail.id} {senderName}
                    </div>
                  )
                })()}
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  상태 {statusLabel(detail.status)} · 접수 {formatDateTime(detail.submittedAt)}
                </div>
                {detail.requesterName ? (
                  <div className="text-xs text-[var(--text-secondary)] mt-1">
                    요청자 정보: {detail.requesterName} / {detail.requesterBirthDate} / {detail.requesterPhone}
                  </div>
                ) : null}
                <div className="text-xs text-[var(--text-secondary)] mt-1">연결고객: {detail.customerName}</div>
                {detail.deviceId ? (
                  <div className="text-xs text-[var(--text-secondary)] mt-1">설치자 기기: {detail.deviceId}</div>
                ) : null}
                {detail.title ? <div className="text-sm mt-2">제목: {detail.title}</div> : null}
                {detail.memo ? <div className="text-sm mt-1 whitespace-pre-wrap">메모: {detail.memo}</div> : null}
              </div>

              <div className="space-y-1">
                <div className="text-sm font-semibold">첨부 파일</div>
                {detail.files.length === 0 ? (
                  <div className="text-xs text-[var(--text-secondary)]">첨부 파일이 없습니다.</div>
                ) : (
                  <ul className="space-y-1">
                    {detail.files.map((file) => (
                      <li key={file.id} className="text-xs flex items-center justify-between gap-3">
                        <span className="truncate">{file.fileName}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <a href={file.url} target="_blank" rel="noreferrer" className="text-blue-600">
                            열기
                          </a>
                          <a href={file.downloadUrl ?? file.url} download={file.fileName} className="text-blue-600">
                            다운로드
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">상태 변경</div>
                <div className="flex gap-2 flex-wrap items-center">
                  <FormSelect
                    className="w-36 text-sm"
                    value={statusTarget}
                    onChange={(event) => setStatusTarget(event.target.value as ClaimRequestStatus)}
                    options={STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
                  />
                  <FormButton htmlType="button" variant="primary" onClick={() => void handleUpdateStatus()} loading={actionBusy}>
                    상태 저장
                  </FormButton>
                </div>
                <FormTextarea
                  className="w-full text-sm"
                  rows={2}
                  value={statusMemo}
                  onChange={(event) => setStatusMemo(event.target.value)}
                  placeholder="상태 변경 메모(선택)"
                  maxLength={255}
                />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-semibold">상태 이력</div>
                {detail.statusLogs.length === 0 ? (
                  <div className="text-xs text-[var(--text-secondary)]">이력이 없습니다.</div>
                ) : (
                  detail.statusLogs.map((log) => (
                    <div key={log.id} className="text-xs text-[var(--text-secondary)]">
                      {formatDateTime(log.changedAt)} · {log.fromStatus ? statusLabel(log.fromStatus) : '초기'} →{' '}
                      {statusLabel(log.toStatus)} {log.memo ? `(${log.memo})` : ''}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : null}
          {selectedRow && !detail ? (
            <div className="text-xs text-[var(--text-secondary)]">
              선택된 요청 #{selectedRow.id}의 상세 정보를 불러오지 못했습니다.
            </div>
          ) : null}
        </div>
      </section>
        </>
      ) : null}

      {activeTab === 'news-all' ? (
        <section className="insurer-news-page">
          <header className="page-header" style={{ marginBottom: 16 }}>
            <h2 style={{ marginBottom: 8 }}>전체소식지업로드</h2>
            <p className="insurer-news-muted">원수사 업로드와 동일한 카드형 리스트/작성 흐름입니다.</p>
          </header>
          <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2" style={{ marginBottom: 16 }}>
            <div className="flex gap-2">
              <FormButton
                htmlType="button"
                variant={newsAllSubTab === 'list' ? 'primary' : 'secondary'}
                onClick={() => setNewsAllSubTab('list')}
              >
                리스트
              </FormButton>
              <FormButton
                htmlType="button"
                variant={newsAllSubTab === 'upload' ? 'primary' : 'secondary'}
                onClick={() => setNewsAllSubTab('upload')}
              >
                업로드
              </FormButton>
            </div>
          </section>
          {newsAllSubTab === 'list' ? (
            <div style={{ marginTop: 16 }}>
              <NewsletterList items={allNewsCards} emptyMessage="등록된 전체소식지가 없습니다." />
            </div>
          ) : null}
          {newsAllSubTab === 'upload' ? (
            <form className="auth-card card" style={{ padding: 16 }} onSubmit={(event) => event.preventDefault()}>
              <label className="field">
                <span className="field__label">제목</span>
                <FormInput
                  className="admin-form-input"
                  value={newsTitle}
                  onChange={(event) => setNewsTitle(event.target.value)}
                  placeholder="제목"
                />
              </label>
              <label className="field">
                <span className="field__label">내용</span>
                <FormTextarea
                  value={allNewsForm.bodyText}
                  onChange={(event) => allNewsForm.setBodyText(event.target.value)}
                  rows={8}
                  className="admin-form-input"
                  style={{ height: 'auto', minHeight: 160, paddingTop: 12, paddingBottom: 12 }}
                  placeholder="본문을 입력하세요"
                />
              </label>
              <div className="field">
                <span className="field__label">파일</span>
                <FileUploader
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  validateFile={validateNewsletterFile}
                  onFiles={(files) => allNewsForm.addAttachments(files)}
                  disabled={Boolean(newsUploadBusy)}
                  primaryHint="이미지 또는 PDF를 드래그하여 놓거나, 클릭하여 선택하세요."
                  hintLines={[
                    '이미지는 본문에 표시되고, PDF는 다운로드 링크로 제공됩니다.',
                    'JPG · PNG · WEBP · GIF · PDF (이미지·PDF 각 최대 10MB)',
                  ]}
                />
                <div className="insurer-news-upload-list">
                  {allNewsForm.attachments.map((row) => (
                    <div key={row.localId} className="insurer-news-upload-row">
                      {row.kind === 'image' && row.previewUrl ? (
                        <img className="insurer-news-upload-row__thumb" src={row.previewUrl} alt="" />
                      ) : (
                        <div className="insurer-news-upload-row__pdf">PDF</div>
                      )}
                      <div className="insurer-news-upload-row__info">
                        <p className="insurer-news-upload-row__name">{row.file.name || '(이름 없음)'}</p>
                        <p
                          className={`insurer-news-upload-row__status${
                            row.status === 'failed' ? ' insurer-news-upload-row__status--err' : ''
                          }`}
                        >
                          {ATTACHMENT_STATUS_LABEL[row.status] ?? row.status}
                          {row.errorMessage ? ` — ${row.errorMessage}` : ''}
                        </p>
                      </div>
                      <FormButton
                        htmlType="button"
                        variant="secondary"
                        className="button button--secondary"
                        onClick={() => allNewsForm.removeAttachment(row.localId)}
                        disabled={Boolean(newsUploadBusy)}
                      >
                        삭제
                      </FormButton>
                    </div>
                  ))}
                </div>
              </div>
              {newsUploadBusy ? (
                <p className="insurer-news-muted" style={{ marginBottom: 12 }}>
                  {newsUploadBusy}
                </p>
              ) : null}
              {newsUploadError ? (
                <p
                  className="insurer-news-upload-row__status insurer-news-upload-row__status--err"
                  style={{ marginBottom: 12, whiteSpace: 'pre-line' }}
                >
                  {newsUploadError}
                </p>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                <FormButton htmlType="button" variant="primary" onClick={() => void handleCreateNews()} loading={actionBusy}>
                  등록
                </FormButton>
              </div>
            </form>
          ) : null}
          {newsResult ? <div className="text-xs text-[var(--text-secondary)] mt-2">{newsResult}</div> : null}
        </section>
      ) : null}

      {activeTab === 'news-personal' ? (
        <section className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-3 insurer-news-page">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2 space-y-2">
            <div className="text-sm font-semibold px-1">연결 고객</div>
            {linkedCustomers.length === 0 ? (
              <div className="px-1 py-2 text-xs text-[var(--text-secondary)]">연결된 고객이 없습니다.</div>
            ) : (
              linkedCustomers.map((customer) => (
                <FormButton
                  key={customer.customerId}
                  htmlType="button"
                  className={`w-full text-left rounded-lg px-2 py-2 border ${
                    selectedCustomerId === customer.customerId
                      ? 'border-blue-500 bg-blue-50/60'
                      : 'border-transparent hover:border-[var(--border-default)]'
                  }`}
                  onClick={() => setSelectedCustomerId(customer.customerId)}
                >
                  <div className="text-sm font-medium">{customer.customerName}</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    기기 {customer.deviceCount} · 마지막 연결 {formatDateTime(customer.lastConnectedAt)}
                  </div>
                </FormButton>
              ))
            )}
          </div>
          <div className="space-y-3">
            <div className="auth-card card" style={{ padding: 16 }}>
              <div className="text-sm font-semibold">개별소식지 작성</div>
            {selectedCustomerId ? (
              <>
                <div className="text-xs text-[var(--text-secondary)] mt-2">
                  선택 고객:{' '}
                  {linkedCustomers.find((customer) => customer.customerId === selectedCustomerId)?.customerName ?? '고객'}
                </div>
                <FormTextarea
                  className="admin-form-input"
                  rows={8}
                  value={personalNewsContent}
                  onChange={(event) => setPersonalNewsContent(event.target.value)}
                  style={{ height: 'auto', minHeight: 160, paddingTop: 12, paddingBottom: 12, marginTop: 8 }}
                  placeholder="선택 고객에게 보낼 소식 내용을 입력해 주세요."
                />
                <FormButton
                  htmlType="button"
                  variant="primary"
                  onClick={() => void handleCreatePersonalNews()}
                  loading={actionBusy}
                >
                  선택 고객에게 전송
                </FormButton>
              </>
            ) : (
              <div className="text-xs text-[var(--text-secondary)]">왼쪽에서 고객을 선택해 주세요.</div>
            )}
            </div>
            <NewsletterList items={personalNewsCards} emptyMessage="해당 고객에게 전송한 소식지가 없습니다." />
          </div>
        </section>
      ) : null}
    </>
  )

  if (isMobile) {
    return <ClaimRequestsPageMobileView>{pageContent}</ClaimRequestsPageMobileView>
  }
  return <ClaimRequestsPagePCView>{pageContent}</ClaimRequestsPagePCView>
}

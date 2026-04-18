import { useCallback, useEffect, useMemo, useState } from 'react'
import { StatusMessage } from '../../../components/feedback'
import { FormButton, FormInput, FormSelect, FormTextarea } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import {
  createCustomerAppLink,
  createCustomerNews,
  getClaimRequestDetail,
  listClaimRequests,
  type ClaimRequestDetail,
  type ClaimRequestListItem,
  type ClaimRequestStatus,
  updateClaimRequestStatus,
} from '../api/claimRequestsApi'

const STATUS_OPTIONS: Array<{ value: ClaimRequestStatus; label: string }> = [
  { value: 'requested', label: '요청됨' },
  { value: 'processing', label: '처리중' },
  { value: 'done', label: '완료' },
  { value: 'rejected', label: '반려' },
  { value: 'canceled', label: '취소' },
]

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
  const { token } = useAuth()
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
  const [newsContent, setNewsContent] = useState('')
  const [newsResult, setNewsResult] = useState('')
  const [actionBusy, setActionBusy] = useState(false)

  const selectedRow = useMemo(() => rows.find((item) => item.id === selectedId) ?? null, [rows, selectedId])

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

  const handleCreateNews = async () => {
    if (!token) {
      return
    }
    if (!newsTitle.trim() || !newsContent.trim()) {
      setError('소식지 제목과 내용을 입력해 주세요.')
      return
    }
    setActionBusy(true)
    setNewsResult('')
    try {
      const created = await createCustomerNews(token, {
        title: newsTitle.trim(),
        content: newsContent.trim(),
        sendPush: true,
      })
      setNewsResult(`고객 소식지 등록 완료: ${created.id}`)
      setNewsTitle('')
      setNewsContent('')
      setError('')
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '소식지 등록에 실패했습니다.')
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

  return (
    <main className="page--with-back content-wrapper space-y-4">
      <div>
        <h1 className="text-lg font-semibold">청구 요청</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          고객앱 링크 생성, 청구 요청 확인/상태 변경, 고객 소식지 등록을 한 화면에서 관리합니다.
        </p>
      </div>

      <StatusMessage message={error} tone="error" />

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
              return (
                <FormButton
                  key={item.id}
                  htmlType="button"
                  className={`w-full text-left rounded-lg px-2 py-2 border ${
                    active ? 'border-blue-500 bg-blue-50/60' : 'border-transparent hover:border-[var(--border-default)]'
                  }`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="text-sm font-medium">{item.customerName}</div>
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
                <div className="text-sm font-semibold">
                  #{detail.id} {detail.customerName}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  상태 {statusLabel(detail.status)} · 접수 {formatDateTime(detail.submittedAt)}
                </div>
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

      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 space-y-2">
        <h2 className="text-sm font-semibold">고객 소식지 등록</h2>
        <FormInput
          className="w-full text-sm"
          value={newsTitle}
          onChange={(event) => setNewsTitle(event.target.value)}
          placeholder="제목"
        />
        <FormTextarea
          className="w-full text-sm"
          rows={4}
          value={newsContent}
          onChange={(event) => setNewsContent(event.target.value)}
          placeholder="내용"
        />
        <FormButton htmlType="button" variant="primary" onClick={() => void handleCreateNews()} loading={actionBusy}>
          고객 소식지 발행
        </FormButton>
        {newsResult ? <div className="text-xs text-[var(--text-secondary)]">{newsResult}</div> : null}
      </section>
    </main>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import { FormButton, FormSelect } from '../../../components/form'
import useIsMobile from '../../../hooks/useIsMobile'
import { useAuth } from '../../auth/AuthProvider'
import ClaimRequestListCard from '../components/ClaimRequestListCard'
import { ClaimRequestDetailBody } from './claim-requests/sections/ClaimRequestDetailSection'
import {
  downloadClaimRequestFile,
  downloadClaimRequestFilesPdf,
  downloadClaimRequestFilesZip,
  getClaimRequestDetail,
  listClaimRequests,
  openClaimRequestFile,
  type ClaimRequestDetail,
  type ClaimRequestFileItem,
  type ClaimRequestListItem,
  type ClaimRequestStatus,
  updateClaimRequestStatus,
} from '../api/claimRequestsApi'
import { openCustomerClaimWorkspace } from '../../customers/utils/customerClaimWorkspaceNavigation'
import { claimRequestStatusLabel } from '../utils/claimRequestStatusUi'
import { resolveClaimRequestCustomerId } from '../utils/resolveClaimRequestCustomerId'
import { formatKstDateTimeDisplay } from '../../../utils/displayDateTime'

const STATUS_OPTIONS: Array<{ value: ClaimRequestStatus | ''; label: string }> = [
  { value: '', label: '전체' },
  { value: 'requested', label: '요청됨' },
  { value: 'processing', label: '처리중' },
  { value: 'done', label: '완료' },
  { value: 'rejected', label: '반려' },
  { value: 'canceled', label: '취소' },
]

const DETAIL_STATUS_OPTIONS: Array<{ value: ClaimRequestStatus; label: string }> = [
  { value: 'requested', label: '요청됨' },
  { value: 'processing', label: '처리중' },
  { value: 'done', label: '완료' },
  { value: 'rejected', label: '반려' },
  { value: 'canceled', label: '취소' },
]

function formatDateTime(iso: string | null): string {
  return formatKstDateTimeDisplay(iso, '—')
}

export default function ClaimInboxPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [rows, setRows] = useState<ClaimRequestListItem[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<ClaimRequestStatus | ''>('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ClaimRequestDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const [statusTarget, setStatusTarget] = useState<ClaimRequestStatus>('processing')
  const [statusMemo, setStatusMemo] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [zipBusy, setZipBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [statusNotice, setStatusNotice] = useState('')
  const [error, setError] = useState('')
  const mobileDetailOpenRef = useRef(false)
  const modalHistoryPushedRef = useRef(false)

  const selectedRow = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId])
  const requestedCount = useMemo(() => rows.filter((row) => row.status === 'requested').length, [rows])
  const processingCount = useMemo(() => rows.filter((row) => row.status === 'processing').length, [rows])

  const loadRows = useCallback(async () => {
    if (!token) {
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await listClaimRequests(token, {
        status,
        page: 1,
        pageSize: 100,
      })
      const nextRows = res.rows ?? []
      setRows(nextRows)
      setTotal(Number(res.total ?? nextRows.length))
      setSelectedId((prev) => {
        if (prev && nextRows.some((row) => row.id === prev)) {
          return prev
        }
        return nextRows[0]?.id ?? null
      })
      if (nextRows.length === 0) {
        setDetail(null)
        setMobileDetailOpen(false)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '청구 요청 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [status, token])

  const loadDetail = useCallback(async () => {
    if (!token || selectedId == null) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    try {
      const data = await getClaimRequestDetail(token, selectedId)
      setDetail(data)
      setStatusTarget(data.status)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '청구 상세를 불러오지 못했습니다.')
    } finally {
      setDetailLoading(false)
    }
  }, [selectedId, token])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  useEffect(() => {
    mobileDetailOpenRef.current = mobileDetailOpen
  }, [mobileDetailOpen])

  useEffect(() => {
    const handlePopState = () => {
      if (!mobileDetailOpenRef.current || !modalHistoryPushedRef.current) {
        return
      }
      modalHistoryPushedRef.current = false
      mobileDetailOpenRef.current = false
      setMobileDetailOpen(false)
      setStatusMemo('')
      setError('')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!statusNotice) {
      return
    }
    const timer = window.setTimeout(() => setStatusNotice(''), 4000)
    return () => window.clearTimeout(timer)
  }, [statusNotice])

  const handleOpenInternalCustomerClaim = useCallback(() => {
    const customerId = resolveClaimRequestCustomerId(detail)
    if (customerId == null) {
      setError('연결된 고객 정보가 없어 청구관리 화면을 열 수 없습니다.')
      return
    }
    setError('')
    openCustomerClaimWorkspace({
      customerId,
      claimRequestId: detail?.id ?? null,
      customerName: detail?.customerName,
      isMobile,
      navigate,
    })
  }, [detail, detail?.customerName, detail?.id, isMobile, navigate])

  const handleDownloadClaimFilesZip = useCallback(async () => {
    if (!token?.trim() || !detail || detail.files.length === 0) {
      return
    }
    setZipBusy(true)
    setError('')
    try {
      await downloadClaimRequestFilesZip(token, detail.id, detail.customerId, {
        customerName: detail.customerName,
        submittedAt: detail.submittedAt,
      })
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'ZIP 다운로드에 실패했습니다.')
    } finally {
      setZipBusy(false)
    }
  }, [detail, token])

  const handleDownloadClaimFilesPdf = useCallback(async () => {
    if (!token?.trim() || !detail || detail.files.length === 0) {
      return
    }
    setPdfBusy(true)
    setError('')
    try {
      await downloadClaimRequestFilesPdf(token, detail.id, detail.customerId, {
        customerName: detail.customerName,
        submittedAt: detail.submittedAt,
      })
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'PDF 다운로드에 실패했습니다.')
    } finally {
      setPdfBusy(false)
    }
  }, [detail, token])

  const openDetailModal = useCallback((row: ClaimRequestListItem) => {
    if (selectedId !== row.id) {
      setDetail(null)
      setStatusMemo('')
    }
    setSelectedId(row.id)
    setMobileDetailOpen(true)
    mobileDetailOpenRef.current = true
    if (!modalHistoryPushedRef.current) {
      window.history.pushState({ claimInboxModal: true }, '', window.location.href)
      modalHistoryPushedRef.current = true
    }
  }, [selectedId])

  const closeDetailModal = useCallback(() => {
    if (modalHistoryPushedRef.current) {
      window.history.back()
      return
    }
    setMobileDetailOpen(false)
    mobileDetailOpenRef.current = false
    setStatusMemo('')
    setError('')
  }, [])

  const handleOpenFile = useCallback(async (file: ClaimRequestFileItem) => {
    if (!token) {
      return
    }
    try {
      await openClaimRequestFile(token, file)
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : '파일을 열지 못했습니다.')
    }
  }, [token])

  const handleDownloadFile = useCallback(async (file: ClaimRequestFileItem) => {
    if (!token) {
      return
    }
    try {
      await downloadClaimRequestFile(token, file)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : '파일을 다운로드하지 못했습니다.')
    }
  }, [token])

  const handleUpdateStatus = useCallback(async () => {
    if (!token || selectedId == null || !detail) {
      return
    }
    const memoToSend = statusMemo.trim()
    if (statusTarget === detail.status && !memoToSend) {
      setError('현재 상태와 동일합니다. 상태를 바꾸거나 메모를 입력해 주세요.')
      return
    }
    setActionBusy(true)
    setError('')
    try {
      const result = await updateClaimRequestStatus(token, selectedId, {
        status: statusTarget,
        memo: memoToSend,
      })
      setStatusMemo('')
      setStatusNotice(
        memoToSend
          ? `상태를 "${claimRequestStatusLabel(result.status)}" 로 변경하고 메모를 기록했습니다.`
          : `상태를 "${claimRequestStatusLabel(result.status)}" 로 변경했습니다.`,
      )
      await loadRows()
      await loadDetail()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '상태 변경에 실패했습니다.')
    } finally {
      setActionBusy(false)
    }
  }, [detail, loadDetail, loadRows, selectedId, statusMemo, statusTarget, token])

  const inboxStatusLabel = useCallback((value: ClaimRequestStatus) => claimRequestStatusLabel(value), [])

  const renderDetailBody = () => (
    <ClaimRequestDetailBody
      detail={detail}
      detailLoading={detailLoading}
      statusTarget={statusTarget}
      statusMemo={statusMemo}
      actionBusy={actionBusy}
      statusOptions={DETAIL_STATUS_OPTIONS}
      onStatusTargetChange={setStatusTarget}
      onStatusMemoChange={setStatusMemo}
      onUpdateStatus={handleUpdateStatus}
      onOpenFile={handleOpenFile}
      onDownloadFile={handleDownloadFile}
      onDownloadZip={handleDownloadClaimFilesZip}
      onDownloadPdf={handleDownloadClaimFilesPdf}
      zipBusy={zipBusy}
      pdfBusy={pdfBusy}
      useNativeFileLinks={isMobile}
      customerPageTarget="crm-internal"
      customerId={detail ? resolveClaimRequestCustomerId(detail) : null}
      onOpenCustomerClaimPage={handleOpenInternalCustomerClaim}
      showCustomerClaimPage
      embeddedInCustomerWorkspace={false}
      showStatusHistory
      statusNotice={statusNotice}
      attachmentActionsVariant={isMobile ? 'mobile' : 'desktop'}
      formatDateTime={formatDateTime}
      statusLabel={inboxStatusLabel}
    />
  )

  return (
    <main className="claim-inbox content-wrapper">
      <StatusMessage message={error} tone="error" />
      <StatusMessage message={statusNotice} tone="success" />

      <section className="claim-inbox__hero">
        <div>
          <h1 className="claim-inbox__title">청구 확인</h1>
          <p className="claim-inbox__subtitle">고객앱에서 접수된 청구 요청을 한 곳에서 확인합니다.</p>
        </div>
        <FormButton htmlType="button" variant="secondary" onClick={() => void loadRows()} loading={loading}>
          새로고침
        </FormButton>
      </section>

      <section className="claim-inbox__summary-grid" aria-label="청구 요청 요약">
        <div className="claim-inbox__summary-card">
          <span>전체</span>
          <strong>{total}</strong>
        </div>
        <div className="claim-inbox__summary-card claim-inbox__summary-card--requested">
          <span>신규 요청</span>
          <strong>{requestedCount}</strong>
        </div>
        <div className="claim-inbox__summary-card claim-inbox__summary-card--processing">
          <span>처리중</span>
          <strong>{processingCount}</strong>
        </div>
      </section>

      <section className="claim-inbox__toolbar">
        <label className="claim-inbox__filter-label">
          상태 필터
          <FormSelect
            value={status}
            onChange={(event) => setStatus(event.target.value as ClaimRequestStatus | '')}
            options={STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
          />
        </label>
      </section>

      <section className="claim-inbox__workspace">
        <aside className="claim-inbox__list-panel" aria-label="청구 요청 목록">
          <div className="claim-inbox__panel-header">
            <h2>요청 목록</h2>
            <span>{rows.length}건</span>
          </div>
          {isMobile ? <p className="claim-inbox__mobile-help">목록을 누르면 상세창이 열립니다. 닫으면 이 목록으로 돌아옵니다.</p> : null}
          {loading ? <div className="claim-inbox__empty">청구 요청을 불러오는 중…</div> : null}
          {!loading && rows.length === 0 ? <div className="claim-inbox__empty">접수된 청구 요청이 없습니다.</div> : null}
          {rows.length > 0 ? (
            <div className="claim-inbox__list">
              {rows.map((row) => (
                <ClaimRequestListCard
                  key={row.id}
                  item={row}
                  active={row.id === selectedId && !isMobile}
                  formatDateTime={formatDateTime}
                  onClick={() => {
                    if (isMobile) {
                      openDetailModal(row)
                      return
                    }
                    setSelectedId(row.id)
                  }}
                />
              ))}
            </div>
          ) : null}
        </aside>

        {!isMobile ? (
          <section className="claim-inbox__detail-panel" aria-label="청구 요청 상세 미리보기">
            <div className="claim-inbox__panel-header">
              <h2>상세 미리보기</h2>
              {selectedRow ? <span>#{selectedRow.id}</span> : null}
            </div>
            <div className="claim-inbox__detail-scroll">{renderDetailBody()}</div>
          </section>
        ) : null}
      </section>

      {isMobile && mobileDetailOpen ? (
        <div className="claim-inbox__modal-backdrop" role="dialog" aria-modal="true" aria-label="청구 상세" onClick={closeDetailModal}>
          <section className="claim-inbox__modal-panel" onClick={(event) => event.stopPropagation()}>
            <header className="claim-inbox__modal-header">
              <button type="button" className="claim-inbox__modal-back" onClick={closeDetailModal}>목록</button>
              <strong>청구 상세</strong>
              <button type="button" className="claim-inbox__modal-close" onClick={closeDetailModal}>닫기</button>
            </header>
            <div className="claim-inbox__modal-body">
              {renderDetailBody()}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

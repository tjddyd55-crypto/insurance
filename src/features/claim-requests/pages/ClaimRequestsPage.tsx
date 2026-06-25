import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import { FormButton, FormInput, FormTextarea } from '../../../components/form'
import Modal from '../../../components/ui/Modal'
import PCOnlySection from '../../../components/PCOnlySection'
import {
  claimRequestStatusBadgeClass,
  claimRequestStatusLabel,
} from '../utils/claimRequestStatusUi'
import useIsMobile from '../../../hooks/useIsMobile'
import { NewsletterList } from '../../insurer-news/components/NewsletterList'
import type { NewsletterItem } from '../../insurer-news/types'
import { ClaimRequestDetailBody } from './claim-requests/sections/ClaimRequestDetailSection'
import ClaimRequestListCard from '../components/ClaimRequestListCard'
import { useAuth } from '../../auth/AuthProvider'
import ClaimRequestsPageMobileView from './claim-requests/ClaimRequestsPageMobileView'
import ClaimRequestsPagePCView from './claim-requests/ClaimRequestsPagePCView'
import {
  createCustomerAppLink,
  createCustomerNews,
  deleteCustomerNews,
  downloadClaimRequestFile,
  downloadClaimRequestFilesPdf,
  downloadClaimRequestFilesZip,
  ensureCustomerClaimPageUrl,
  getClaimRequestDetail,
  getCustomerAppLink,
  getCustomerClaimPageUrl,
  listAgentCustomerNews,
  listClaimRequests,
  listLinkedCustomers,
  openClaimRequestFile,
  type AgentCustomerNewsItem,
  type ClaimRequestDetail,
  type ClaimRequestListItem,
  type ClaimRequestStatus,
  type CustomerAppLinkInfo,
  type LinkedCustomerItem,
  updateClaimRequestStatus,
} from '../api/claimRequestsApi'
import {
  customerAppLinkActionLabel,
  describeCustomerAppConnection,
  notifyCustomerAppLinkUpdated,
  resolveCustomerAppConnectionState,
} from '../model/customerAppLinkConnection'
import { openCustomerClaimPageUrl } from '../utils/customerClaimPageActions'
import { formatKstDateTimeDisplay } from '../../../utils/displayDateTime'

const STATUS_OPTIONS: Array<{ value: ClaimRequestStatus; label: string }> = [
  { value: 'requested', label: '요청됨' },
  { value: 'processing', label: '처리중' },
  { value: 'done', label: '완료' },
  { value: 'rejected', label: '반려' },
  { value: 'canceled', label: '취소' },
]

function formatDateTime(iso: string | null): string {
  return formatKstDateTimeDisplay(iso, '—')
}

function statusLabel(status: ClaimRequestStatus): string {
  return claimRequestStatusLabel(status)
}

function statusBadgeClass(status: ClaimRequestStatus): string {
  return claimRequestStatusBadgeClass(status)
}

function parsePositiveInt(raw: string | null): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

export default function ClaimRequestsPage() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { token } = useAuth()
  const location = useLocation()
  const { customerId: customerIdParam } = useParams<{ customerId?: string }>()
  const [searchParams] = useSearchParams()
  const embedInCustomerWorkspace = useMemo(
    () => /^\/customers\/\d+(\/|$)/.test(location.pathname),
    [location.pathname],
  )
  const claimTabParam = searchParams.get('claimTab')
  const activeCustomerId = useMemo(() => {
    const fromQuery = parsePositiveInt(searchParams.get('customerId'))
    if (fromQuery != null) {
      return fromQuery
    }
    return parsePositiveInt(customerIdParam ?? null)
  }, [customerIdParam, searchParams])
  const targetClaimId = useMemo(() => parsePositiveInt(searchParams.get('claimId')), [searchParams])
  const [activeTab, setActiveTab] = useState<'claims' | 'news-personal'>('claims')
  const [rows, setRows] = useState<ClaimRequestListItem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ClaimRequestDetail | null>(null)
  const [linkStatus, setLinkStatus] = useState<CustomerAppLinkInfo | null>(null)
  const [linkStatusLoading, setLinkStatusLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusMemo, setStatusMemo] = useState('')
  const [statusTarget, setStatusTarget] = useState<ClaimRequestStatus>('processing')
  /*
   * 상태 변경 성공 피드백 — 저장 직후 loadDetail 로 전체가 리렌더되기 전에 "저장됐다" 를
   * 즉시 알려주기 위한 분리된 state. error 와 채널을 구분해 "성공 직후 기타 요청 실패"
   * 로 성공 메시지가 덮이는 회귀를 막는다. 타이머로 자동 해제(아래 useEffect 참고).
   */
  const [statusNotice, setStatusNotice] = useState('')
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const [createdLink, setCreatedLink] = useState('')
  const [createdCode, setCreatedCode] = useState('')
  const [copyResult, setCopyResult] = useState('')
  const [newsResult, setNewsResult] = useState('')
  const [linkedCustomers, setLinkedCustomers] = useState<LinkedCustomerItem[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [personalNewsContent, setPersonalNewsContent] = useState('')
  const [newsHistoryPersonal, setNewsHistoryPersonal] = useState<AgentCustomerNewsItem[]>([])
  const [customerNewsDeletingId, setCustomerNewsDeletingId] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [zipBusy, setZipBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [customerClaimPageBusy, setCustomerClaimPageBusy] = useState(false)
  const displayedCode = createdCode || linkStatus?.agentCode || linkStatus?.linkCode || ''
  const customerClaimPageUrl = createdLink || getCustomerClaimPageUrl(linkStatus)
  const displayedLink = customerClaimPageUrl

  const selectedRow = useMemo(() => rows.find((item) => item.id === selectedId) ?? null, [rows, selectedId])
  const latestDeviceLabel = useMemo(() => {
    if (detail?.deviceId?.trim()) {
      return detail.deviceId.trim()
    }
    if (selectedRow?.deviceId?.trim()) {
      return selectedRow.deviceId.trim()
    }
    return '미확인'
  }, [detail?.deviceId, selectedRow?.deviceId])
  const connectionState = useMemo(() => resolveCustomerAppConnectionState(linkStatus), [linkStatus])
  const connectionMeta = useMemo(
    () => describeCustomerAppConnection(connectionState, linkStatus, formatDateTime),
    [connectionState, linkStatus],
  )
  const linkActionLabel = useMemo(() => customerAppLinkActionLabel(connectionState), [connectionState])
  const personalNewsCards = useMemo<NewsletterItem[]>(
    () =>
      newsHistoryPersonal.map((item) => ({
        id: item.id,
        gaCode: 'customer-news',
        insurerCode: 'customer-news-personal',
        insurerName: '개인메시지',
        insurerSlug: 'personal',
        title: item.title,
        summary: item.content,
        heroImageUrl: item.heroImageUrl ?? null,
        publishedAt: item.updatedAt ?? new Date().toISOString(),
        status: 'PUBLISHED',
        hasImages: Boolean(item.attachments?.some((attachment) => attachment.kind === 'image')),
        hasPdf: Boolean(item.attachments?.some((attachment) => attachment.kind === 'file')),
        hasTextBody: Boolean(item.content?.trim()),
        customerNewsScope: 'personal',
        targetCustomerId: item.targetCustomerId ?? null,
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
      const res = await listClaimRequests(token, {
        page: 1,
        pageSize: 50,
        customerId: activeCustomerId,
      })
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
        setSelectedId((prev) => {
          if (targetClaimId != null && rows.some((item) => item.id === targetClaimId)) {
            return targetClaimId
          }
          return prev ?? rows[0].id
        })
      } else {
        setSelectedId(null)
        setDetail(null)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '요청 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [activeCustomerId, targetClaimId, token])

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

  useEffect(() => {
    if (activeTab !== 'claims' && mobileDetailOpen) {
      setMobileDetailOpen(false)
    }
  }, [activeTab, mobileDetailOpen])

  const loadLinkStatus = useCallback(async () => {
    if (!token?.trim() || !activeCustomerId) {
      setLinkStatus(null)
      return
    }
    setLinkStatusLoading(true)
    try {
      const current = await getCustomerAppLink(token, activeCustomerId)
      setLinkStatus(current)
    } catch {
      setLinkStatus(null)
    } finally {
      setLinkStatusLoading(false)
    }
  }, [activeCustomerId, token])

  useEffect(() => {
    if (embedInCustomerWorkspace) {
      setLinkStatus(null)
      return
    }
    void loadLinkStatus()
  }, [loadLinkStatus, embedInCustomerWorkspace])

  useEffect(() => {
    if (activeCustomerId) {
      if (claimTabParam === 'news-personal') {
        setActiveTab('news-personal')
        return
      }
      setActiveTab('claims')
      return
    }
    if (claimTabParam === 'news-personal') {
      setActiveTab('news-personal')
      return
    }
    setActiveTab('claims')
  }, [activeCustomerId, claimTabParam])

  useEffect(() => {
    setCreatedLink('')
    setCreatedCode('')
    setCopyResult('')
  }, [activeCustomerId])

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

  const goClaimMessengerTab = useCallback(
    (tab: 'news-all' | 'news-personal') => {
      const next = new URLSearchParams(location.search)
      next.set('claimTab', tab)
      const q = next.toString()
      navigate(`${location.pathname}${q ? `?${q}` : ''}`)
    },
    [location.pathname, location.search, navigate],
  )

  const handleDeletePersonalCustomerNews = useCallback(
    async (item: NewsletterItem) => {
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
      const tid = item.targetCustomerId ?? selectedCustomerId ?? null
      if (tid == null || !Number.isInteger(tid)) {
        setError('삭제할 대상 고객을 확인할 수 없습니다.')
        return
      }
      setCustomerNewsDeletingId(item.id)
      setError('')
      try {
        await deleteCustomerNews(token, item.id, { targetCustomerId: tid })
        setNewsResult('소식지를 삭제했습니다.')
        await loadNewsHistory(selectedCustomerId)
      } catch (deleteErr) {
        setError(deleteErr instanceof Error ? deleteErr.message : '소식지 삭제에 실패했습니다.')
      } finally {
        setCustomerNewsDeletingId(null)
      }
    },
    [token, loadNewsHistory, selectedCustomerId],
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
    if (!activeCustomerId) {
      setError('먼저 좌측 고객 리스트에서 고객을 선택해 주세요.')
      return
    }
    setActionBusy(true)
    setCreatedLink('')
    setCreatedCode('')
    try {
      const res = await createCustomerAppLink(token, activeCustomerId)
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
      await loadLinkStatus()
      notifyCustomerAppLinkUpdated()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '링크 생성에 실패했습니다.')
    } finally {
      setActionBusy(false)
    }
  }

  /**
   * 상태/메모 저장 핸들러.
   *
   * 흐름:
   *   1) 방어: 동일 상태 + 빈 메모는 서버 왕복 전에 차단(무의미한 요청 억제).
   *   2) API 호출 후 응답 필드로 **낙관적 UI 반영** — `statusLogs` 에 방금 기록을 즉시
   *      append 한다. 이후 `loadDetail` 이 서버 정식 데이터로 대체한다.
   *      → 서버가 실제로 저장을 실패하면 "잠깐 보였다 사라진다" 로 증상이 뚜렷해져
   *        서버측 원인을 빠르게 식별 가능.
   *   3) 성공/실패를 `statusNotice`/`error` 분리 채널로 피드백.
   *   4) 실패 시 `console.error` 로 원본 에러 남겨 운영 중 원인 추적을 돕는다.
   */
  const handleUpdateStatus = async () => {
    if (!token || selectedId == null || !detail) {
      return
    }
    const memoToSend = statusMemo.trim()
    if (statusTarget === detail.status && !memoToSend) {
      setStatusNotice('')
      setError('현재 상태와 동일합니다. 상태를 바꾸거나 메모를 입력해 주세요.')
      return
    }
    setError('')
    setActionBusy(true)
    try {
      const result = await updateClaimRequestStatus(token, selectedId, {
        status: statusTarget,
        memo: memoToSend,
      })
      setDetail((prev) => {
        if (!prev) {
          return prev
        }
        return {
          ...prev,
          status: result.status,
          statusLogs: [
            ...prev.statusLogs,
            {
              // 음수 임시 id — loadDetail 이 실제 id 로 덮어쓰기 전 중복 key 회피용.
              id: -Date.now(),
              fromStatus: result.fromStatus ?? prev.status,
              toStatus: result.status,
              changedByUserId: null,
              changedAt: new Date().toISOString(),
              memo: result.memo ?? memoToSend,
            },
          ],
        }
      })
      setStatusMemo('')
      setStatusNotice(
        memoToSend
          ? `상태를 "${statusLabel(result.status)}" 로 변경하고 메모를 기록했습니다.`
          : `상태를 "${statusLabel(result.status)}" 로 변경했습니다.`,
      )
      await loadList()
      await loadDetail()
    } catch (actionError) {
      console.error('[claim-requests] 상태 변경 실패', actionError)
      setStatusNotice('')
      setError(actionError instanceof Error ? actionError.message : '상태 변경에 실패했습니다.')
    } finally {
      setActionBusy(false)
    }
  }

  /*
   * 성공 메시지 자동 해제 — 4 초 뒤 지워서 화면을 항상 깨끗하게 유지.
   * error 는 사용자가 원인을 재확인해야 하므로 자동 해제하지 않는다.
   */
  useEffect(() => {
    if (!statusNotice) {
      return
    }
    const timer = window.setTimeout(() => setStatusNotice(''), 4000)
    return () => window.clearTimeout(timer)
  }, [statusNotice])

  const handleCreatePersonalNews = async () => {
    if (!token) {
      return
    }
    if (!selectedCustomerId) {
      setError('개인메시지를 보낼 고객을 선택해 주세요.')
      return
    }
    if (!personalNewsContent.trim()) {
      setError('개인메시지 내용을 입력해 주세요.')
      return
    }
    setActionBusy(true)
    setNewsResult('')
    try {
      const customer = linkedCustomers.find((item) => item.customerId === selectedCustomerId)
      const title = customer ? `${customer.customerName} 고객님께` : '개인메시지'
      const created = await createCustomerNews(token, {
        title,
        content: personalNewsContent.trim(),
        scope: 'personal',
        targetCustomerId: selectedCustomerId,
        sendPush: true,
      })
      setNewsResult(`개인메시지 발송 완료: ${created.id}`)
      setPersonalNewsContent('')
      await loadNewsHistory(selectedCustomerId)
      setError('')
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '개인메시지 발송에 실패했습니다.')
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

  const handleOpenLinkPreview = useCallback(() => {
    if (!displayedLink.trim()) {
      return
    }
    window.open(displayedLink, '_blank', 'noopener,noreferrer')
  }, [displayedLink])

  const handleShareBySms = useCallback(async () => {
    if (!displayedLink.trim()) {
      setError('먼저 링크를 생성해 주세요.')
      return
    }
    await handleCopyText(displayedLink, 'URL')
    window.location.href = `sms:?body=${encodeURIComponent(displayedLink)}`
  }, [displayedLink, handleCopyText])

  const handleShareByKakao = useCallback(async () => {
    if (!displayedLink.trim()) {
      setError('먼저 링크를 생성해 주세요.')
      return
    }
    await handleCopyText(displayedLink, 'URL')
    setCopyResult('카카오톡으로 공유할 URL을 복사했습니다.')
  }, [displayedLink, handleCopyText])

  const handleSelectClaim = useCallback(
    (id: number) => {
      setSelectedId(id)
      if (isMobile) {
        setMobileDetailOpen(true)
      }
    },
    [isMobile],
  )

  const handleOpenClaimFile = useCallback(
    async (file: ClaimRequestDetail['files'][number]) => {
      if (!token?.trim()) {
        setError('로그인이 필요합니다.')
        return
      }
      try {
        await openClaimRequestFile(token, file)
      } catch (openError) {
        setError(openError instanceof Error ? openError.message : '파일 열기에 실패했습니다.')
      }
    },
    [token],
  )

  const handleDownloadClaimFile = useCallback(
    async (file: ClaimRequestDetail['files'][number]) => {
      if (!token?.trim()) {
        setError('로그인이 필요합니다.')
        return
      }
      try {
        await downloadClaimRequestFile(token, file)
      } catch (downloadError) {
        setError(downloadError instanceof Error ? downloadError.message : '파일 다운로드에 실패했습니다.')
      }
    },
    [token],
  )

  const handleDownloadClaimFilesZip = useCallback(async () => {
    if (!token?.trim()) {
      setError('로그인이 필요합니다.')
      return
    }
    if (!detail || detail.files.length === 0) {
      return
    }
    setZipBusy(true)
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
    if (!token?.trim()) {
      setError('로그인이 필요합니다.')
      return
    }
    if (!detail || detail.files.length === 0) {
      return
    }
    setPdfBusy(true)
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

  const handleOpenCustomerClaimPage = useCallback(async () => {
    if (!token?.trim()) {
      setError('로그인이 필요합니다.')
      return
    }
    const customerId = activeCustomerId ?? detail?.customerId ?? null
    if (!customerId) {
      setError('고객을 선택해 주세요.')
      return
    }
    setCustomerClaimPageBusy(true)
    setError('')
    try {
      const url = await ensureCustomerClaimPageUrl(token, customerId)
      setCreatedLink(url)
      openCustomerClaimPageUrl(url)
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : '고객 청구 페이지를 열지 못했습니다.')
    } finally {
      setCustomerClaimPageBusy(false)
    }
  }, [activeCustomerId, detail?.customerId, token])

  const claimDetailBody =
    selectedRow && !detail && !detailLoading ? (
      <div className="claim-requests-page__detail-empty">선택한 청구 요청 상세를 불러오지 못했습니다.</div>
    ) : (
      <ClaimRequestDetailBody
        detail={detail}
        detailLoading={detailLoading}
        statusTarget={statusTarget}
        statusMemo={statusMemo}
        actionBusy={actionBusy}
        statusOptions={STATUS_OPTIONS}
        onStatusTargetChange={setStatusTarget}
        onStatusMemoChange={setStatusMemo}
        onUpdateStatus={handleUpdateStatus}
        onOpenFile={handleOpenClaimFile}
        onDownloadFile={handleDownloadClaimFile}
        onDownloadZip={handleDownloadClaimFilesZip}
        onDownloadPdf={handleDownloadClaimFilesPdf}
        zipBusy={zipBusy}
        pdfBusy={pdfBusy}
        useNativeFileLinks={isMobile}
        customerClaimPageUrl={customerClaimPageUrl}
        customerClaimPageBusy={customerClaimPageBusy}
        onOpenCustomerClaimPage={handleOpenCustomerClaimPage}
        showCustomerClaimPage={!embedInCustomerWorkspace}
        embeddedInCustomerWorkspace={embedInCustomerWorkspace}
        showStatusHistory={false}
        statusNotice={statusNotice}
        attachmentActionsVariant={isMobile ? 'mobile' : 'desktop'}
        formatDateTime={formatDateTime}
        statusLabel={statusLabel}
      />
    )

  const claimStatusTimeline = detail ? (
    <div className="claim-requests-page__timeline-list">
      {detail.statusLogs.length === 0 ? (
        <div className="claim-requests-page__timeline-empty">이력이 없습니다.</div>
      ) : (
        detail.statusLogs
          .slice()
          .reverse()
          .map((log) => (
            <div key={log.id} className="claim-requests-page__timeline-item">
              <div className="claim-requests-page__timeline-dot" />
              <div className="claim-requests-page__timeline-content">
                <p className="claim-requests-page__timeline-time">{formatDateTime(log.changedAt)}</p>
                <p className="claim-requests-page__timeline-state">
                  {log.fromStatus ? statusLabel(log.fromStatus) : '초기'} → {statusLabel(log.toStatus)}
                </p>
                {log.memo ? <p className="claim-requests-page__timeline-memo">{log.memo}</p> : null}
              </div>
            </div>
          ))
      )}
    </div>
  ) : (
    <div className="claim-requests-page__timeline-empty">청구 요청을 선택해 주세요.</div>
  )

  const pageContent = (
    <>
      <StatusMessage message={error} tone="error" />

      {!activeCustomerId ? (
        <section className="claim-requests-page__tab-section">
          <div className="claim-requests-page__tabs">
            <FormButton
              htmlType="button"
              variant={claimTabParam === 'news-all' ? 'primary' : 'secondary'}
              onClick={() => goClaimMessengerTab('news-all')}
            >
              전체소식지
            </FormButton>
            <FormButton
              htmlType="button"
              variant={claimTabParam === 'news-personal' ? 'primary' : 'secondary'}
              onClick={() => goClaimMessengerTab('news-personal')}
            >
              개인메시지
            </FormButton>
          </div>
        </section>
      ) : null}

      {activeTab === 'claims' ? (
        <>
          {!embedInCustomerWorkspace ? (
          <section className="claim-requests-page__connect-top">
            <article className="claim-requests-page__connect-card">
              <div className="claim-requests-page__connect-card-head">
                <h2>링크 발송</h2>
                <FormButton
                  htmlType="button"
                  variant="primary"
                  onClick={() => void handleCreateLink()}
                  loading={actionBusy}
                  disabled={!activeCustomerId}
                >
                  {linkActionLabel}
                </FormButton>
              </div>
              <div className="claim-requests-page__connect-row">
                <span className="claim-requests-page__connect-label">연결 코드</span>
                <FormInput className="claim-requests-page__connect-input" value={displayedCode || '미생성'} readOnly />
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  onClick={() => void handleCopyText(displayedCode, '코드')}
                  disabled={!displayedCode}
                >
                  복사
                </FormButton>
              </div>
              <div className="claim-requests-page__connect-row">
                <span className="claim-requests-page__connect-label">연결 URL</span>
                <FormInput className="claim-requests-page__connect-input" value={displayedLink || '미생성'} readOnly />
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  onClick={() => void handleCopyText(displayedLink, 'URL')}
                  disabled={!displayedLink}
                >
                  복사
                </FormButton>
              </div>
              <div className="claim-requests-page__connect-actions">
                <FormButton htmlType="button" variant="secondary" onClick={() => void handleShareBySms()} disabled={!displayedLink}>
                  문자 발송
                </FormButton>
                <FormButton htmlType="button" variant="secondary" onClick={() => void handleShareByKakao()} disabled={!displayedLink}>
                  카카오 발송
                </FormButton>
                <FormButton htmlType="button" variant="secondary" onClick={handleOpenLinkPreview} disabled={!displayedLink}>
                  링크 미리보기
                </FormButton>
              </div>
              {copyResult ? <p className="claim-requests-page__copy-result">{copyResult}</p> : null}
            </article>

            <article className="claim-requests-page__status-card">
              <h2>연결 상태</h2>
              {linkStatusLoading ? <p className="claim-requests-page__status-loading">상태를 확인하는 중…</p> : null}
              <div className="claim-requests-page__status-grid">
                <div>
                  <p className="claim-requests-page__status-key">연결 상태</p>
                  <p className={connectionMeta.className}>{connectionMeta.title}</p>
                  <p className="claim-requests-page__status-sub">{connectionMeta.subtitle}</p>
                </div>
                <div>
                  <p className="claim-requests-page__status-key">최초 연결</p>
                  <p className="claim-requests-page__status-value">{formatDateTime(linkStatus?.createdAt ?? null)}</p>
                </div>
                <div>
                  <p className="claim-requests-page__status-key">최근 활동</p>
                  <p className="claim-requests-page__status-value">{formatDateTime(linkStatus?.lastConnectedAt ?? null)}</p>
                </div>
                <div>
                  <p className="claim-requests-page__status-key">연결 기기</p>
                  <p className="claim-requests-page__status-value">{latestDeviceLabel}</p>
                </div>
                <div>
                  <p className="claim-requests-page__status-key">연결 IP</p>
                  <p className="claim-requests-page__status-value">미수집</p>
                </div>
              </div>
            </article>
          </section>
          ) : null}

          <section
            className={
              embedInCustomerWorkspace
                ? 'claim-requests-page__claims-grid claim-requests-page__claims-grid--embedded'
                : 'claim-requests-page__claims-grid'
            }
          >
            <article className="claim-requests-page__panel claim-requests-page__panel--list">
              <div className="claim-requests-page__panel-head">
                <h3>청구 요청</h3>
                <div className="claim-requests-page__panel-head-tools">
                  <span>총 {rows.length}건</span>
                  <FormButton htmlType="button" variant="secondary" onClick={() => void loadList()} disabled={loading}>
                    새로고침
                  </FormButton>
                </div>
              </div>
              {loading ? <div className="claim-requests-page__panel-empty">불러오는 중…</div> : null}
              {!loading && rows.length === 0 ? (
                <div className="claim-requests-page__panel-empty">
                  {activeCustomerId ? '선택 고객의 청구 요청이 없습니다.' : '청구 요청이 없습니다.'}
                </div>
              ) : null}
              <div className="claim-requests-page__list">
                {rows.map((item) => (
                  <ClaimRequestListCard
                    key={item.id}
                    item={item}
                    active={item.id === selectedId}
                    formatDateTime={formatDateTime}
                    onClick={() => handleSelectClaim(item.id)}
                  />
                ))}
              </div>
            </article>

            <article className="claim-requests-page__panel claim-requests-page__panel--detail">
              <div className="claim-requests-page__panel-head">
                <h3>청구 요청 상세</h3>
              </div>
              <div className="claim-requests-page__detail-scroll">{claimDetailBody}</div>
            </article>

            <PCOnlySection fallback={null}>
              <article className="claim-requests-page__panel claim-requests-page__panel--timeline">
                <div className="claim-requests-page__panel-head">
                  <h3>상태 이력</h3>
                  <div className="claim-requests-page__panel-head-tools">
                    <FormButton htmlType="button" variant="secondary" onClick={() => void loadDetail()} disabled={detailLoading}>
                      요약
                    </FormButton>
                  </div>
                </div>
                <div className="claim-requests-page__timeline-scroll">{claimStatusTimeline}</div>
              </article>
            </PCOnlySection>
          </section>
        </>
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
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-soft)] text-[var(--text-primary)]'
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
              <div className="text-sm font-semibold">개인메시지 작성</div>
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
                  placeholder="선택 고객에게 보낼 메시지 내용을 입력해 주세요."
                />
                <FormButton
                  htmlType="button"
                  variant="primary"
                  onClick={() => void handleCreatePersonalNews()}
                  loading={actionBusy}
                >
                  선택 고객에게 발송
                </FormButton>
              </>
            ) : (
              <div className="text-xs text-[var(--text-secondary)]">왼쪽에서 고객을 선택해 주세요.</div>
            )}
            </div>
            <NewsletterList
              items={personalNewsCards}
              emptyMessage="해당 고객에게 발송한 개인메시지가 없습니다."
              variant={isMobile ? 'mobile' : 'pc'}
              onDeleteItem={(card) => void handleDeletePersonalCustomerNews(card)}
              deleteBusyId={customerNewsDeletingId}
            />
            {newsResult ? (
              <p className="text-xs text-[var(--text-secondary)]">{newsResult}</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  )

  if (isMobile) {
    return (
      <ClaimRequestsPageMobileView>
        {pageContent}
        <Modal
          open={mobileDetailOpen}
          onClose={() => setMobileDetailOpen(false)}
          ariaLabel="청구 요청 상세"
          panelClassName="claim-requests-mobile-detail-modal"
        >
          <div className="claim-requests-mobile-detail-modal__header">
            <span className="claim-requests-mobile-detail-modal__spacer" aria-hidden />
            <div className="claim-requests-mobile-detail-modal__title">청구 관리</div>
            <FormButton
              htmlType="button"
              variant="secondary"
              size="sm"
              className="claim-requests-mobile-detail-modal__close"
              onClick={() => setMobileDetailOpen(false)}
            >
              닫기
            </FormButton>
          </div>
          <div className="claim-requests-mobile-detail-modal__body">
            {claimDetailBody}
            <div className="claim-requests-mobile-detail-modal__timeline">
              <div className="claim-requests-page__detail-subtitle">상태 이력</div>
              {claimStatusTimeline}
            </div>
          </div>
        </Modal>
      </ClaimRequestsPageMobileView>
    )
  }
  return <ClaimRequestsPagePCView>{pageContent}</ClaimRequestsPagePCView>
}

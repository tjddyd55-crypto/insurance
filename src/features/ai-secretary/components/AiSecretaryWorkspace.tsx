import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import { validateAiImportAttachmentFile } from '../aiSecretaryImportFile'
import { useAiPageContext, useAiSecretary } from '../context/AiSecretaryContext'
import {
  confirmAiImportCommit,
  fetchImportMapping,
  fetchImportAnalysisJob,
  fetchLatestAiConversation,
  sendAiAssistantMessage,
  updateImportMapping,
  uploadAiImportFile,
  type AiAssistantMessage,
  type AiUiAction,
  type ImportMappingRow,
} from '../api/aiSecretaryApi'
import '../pages/ai-secretary-page.css'
import './ai-secretary-panel.css'

const SUGGESTIONS = ['고객 엑셀 가져오기', '고객 찾기', '오늘 할 일', '일정 확인']
const IGNORE_VALUE = '__IGNORE__'
const UNSTRUCTURED_SOURCE_MODE = 'UNSTRUCTURED_CELL_RECORDS'

const PREVIEW_FINAL_STATUS_LABEL: Record<string, string> = {
  AUTO_ELIGIBLE: '등록 예정',
  REVIEW_REQUIRED: '확인 필요',
  DUPLICATE_SKIPPED: '중복 제외',
  INVALID: '오류',
}

type AttachmentUiState = {
  name: string
  status: 'uploading' | 'ready' | 'error'
  errorMessage?: string
}

type Props = {
  variant: 'page' | 'panel'
  onClose?: () => void
}

function mappingStatusLabel(status: ImportMappingRow['status']) {
  if (status === 'confirmed') {
    return '확정'
  }
  if (status === 'review') {
    return '확인 필요'
  }
  if (status === 'ignored') {
    return '제외'
  }
  return '미지정'
}

function applySafeUiActions(navigate: (path: string) => void, actions?: AiUiAction[]) {
  if (!actions?.length) {
    return
  }
  for (const action of actions) {
    if (action.type !== 'navigate.customer.detail') {
      continue
    }
    const path = String(action.path ?? '')
    const id = Number(action.customerId)
    if (!path.startsWith('/customers?customerId=') || !Number.isInteger(id) || id < 1) {
      continue
    }
    if (path !== `/customers?customerId=${id}`) {
      continue
    }
    navigate(path)
  }
}

export default function AiSecretaryWorkspace({ variant, onClose }: Props) {
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const { openFullPage } = useAiSecretary()
  const pageContext = useAiPageContext()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const dragDepthRef = useRef(0)
  const [dragActive, setDragActive] = useState(false)
  const [attachment, setAttachment] = useState<AttachmentUiState | null>(null)
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [importSessionId, setImportSessionId] = useState<string | undefined>()
  const [messages, setMessages] = useState<AiAssistantMessage[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mappingOpen, setMappingOpen] = useState(false)
  const [mappingRows, setMappingRows] = useState<ImportMappingRow[]>([])
  const [fieldOptions, setFieldOptions] = useState<Array<{ key: string; label: string }>>([])
  const [issueOpen, setIssueOpen] = useState(false)
  const [issueRows, setIssueRows] = useState<
    Extract<AiAssistantMessage, { kind: 'import_preview_card' }>['issueRows']
  >([])
  const jobPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isGaDesigner =
    user?.role === 'USER' || user?.role === 'GA_ADMIN' || user?.role === 'GA_STAFF'

  const stopJobPolling = useCallback(() => {
    if (jobPollRef.current) {
      clearInterval(jobPollRef.current)
      jobPollRef.current = null
    }
  }, [])

  const refreshConversation = useCallback(async () => {
    if (!token) {
      return
    }
    const res = await fetchLatestAiConversation(token)
    const conv = res.conversation
    if (!conv) {
      return
    }
    setConversationId(conv.conversationId)
    if (conv.importSessionId) {
      setImportSessionId(conv.importSessionId)
    }
    if (Array.isArray(conv.messages) && conv.messages.length > 0) {
      setMessages(conv.messages)
    }
  }, [token])

  const startJobPolling = useCallback(
    (jobId: string) => {
      if (!token) {
        return
      }
      stopJobPolling()
      setBusy(true)
      jobPollRef.current = setInterval(() => {
        void (async () => {
          try {
            const job = await fetchImportAnalysisJob(token, jobId)
            setMessages((prev) =>
              prev.map((m) =>
                m.kind === 'import_analysis_progress' && m.jobId === jobId
                  ? {
                      ...m,
                      status: job.status,
                      displayPhase: job.displayPhase,
                      progress: job.progress,
                    }
                  : m,
              ),
            )
            if (job.status === 'PREVIEW_READY' || job.status === 'FAILED') {
              stopJobPolling()
              await refreshConversation()
              setBusy(false)
              if (job.status === 'FAILED') {
                setError(job.error?.message ?? '고객자료 분석에 실패했습니다.')
              }
            }
          } catch (e) {
            stopJobPolling()
            setBusy(false)
            setError(e instanceof Error ? e.message : '분석 상태 조회 실패')
          }
        })()
      }, 1500)
    },
    [refreshConversation, stopJobPolling, token],
  )

  useEffect(() => {
    if (!token || !isGaDesigner) {
      return
    }
    void fetchLatestAiConversation(token)
      .then((res) => {
        const conv = res.conversation
        if (!conv) {
          return
        }
        setConversationId(conv.conversationId)
        if (conv.importSessionId) {
          setImportSessionId(conv.importSessionId)
        }
        if (Array.isArray(conv.messages) && conv.messages.length > 0) {
          setMessages(conv.messages)
        }
        const activeJobId = (conv.importContext as { activeAnalysisJobId?: string } | null)?.activeAnalysisJobId
        if (activeJobId) {
          startJobPolling(activeJobId)
        }
      })
      .catch(() => undefined)
    return () => stopJobPolling()
  }, [token, isGaDesigner, startJobPolling, stopJobPolling])

  async function handleSend(forcedText?: string) {
    if (!token || busy) {
      return
    }
    const payload = (forcedText ?? text).trim()
    if (!payload) {
      return
    }
    setBusy(true)
    setError(null)
    setMessages((prev) => [...prev, { role: 'user', kind: 'text', text: payload }])
    setText('')
    try {
      const res = await sendAiAssistantMessage(token, {
        conversationId,
        text: payload,
        importSessionId,
        pageContext,
      })
      setConversationId(res.conversationId)
      setMessages((prev) => [...prev, ...res.messages])
      for (const m of res.messages) {
        if (m.role === 'assistant' && 'uiActions' in m) {
          applySafeUiActions(navigate, m.uiActions)
        }
      }
      if (res.analysisJobId) {
        startJobPolling(res.analysisJobId)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '전송 실패')
    } finally {
      setBusy(false)
    }
  }

  const attachImportFile = useCallback(
    async (file: File) => {
      if (!token) {
        return
      }
      const validationError = validateAiImportAttachmentFile(file)
      if (validationError) {
        setAttachment({ name: file.name, status: 'error', errorMessage: validationError })
        setError(validationError)
        return
      }
      setBusy(true)
      setError(null)
      setAttachment({ name: file.name, status: 'uploading' })
      try {
        const res = await uploadAiImportFile(token, file, { conversationId })
        setImportSessionId(res.importSessionId)
        setAttachment({ name: file.name, status: 'ready' })
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', kind: 'text', text: `파일을 첨부했습니다: ${file.name}` },
        ])
      } catch (e) {
        const message = e instanceof Error ? e.message : '첨부 실패'
        setAttachment({ name: file.name, status: 'error', errorMessage: message })
        setError(message)
      } finally {
        setBusy(false)
      }
    },
    [conversationId, token],
  )

  function handleFileInputChange(file: File | null) {
    if (!file) {
      return
    }
    void attachImportFile(file)
    if (fileRef.current) {
      fileRef.current.value = ''
    }
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!event.dataTransfer.types.includes('Files')) {
      return
    }
    dragDepthRef.current += 1
    setDragActive(true)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setDragActive(false)
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepthRef.current = 0
    setDragActive(false)
    const file = event.dataTransfer.files?.[0]
    if (file) {
      void attachImportFile(file)
    }
  }

  function clearAttachment() {
    setAttachment(null)
    setError(null)
  }

  async function openMappingDetail(card: Extract<AiAssistantMessage, { kind: 'import_preview_card' }>) {
    if (!token || !importSessionId) {
      return
    }
    setBusy(true)
    try {
      const data = await fetchImportMapping(token, importSessionId)
      setMappingRows(card.mappingRows?.length ? card.mappingRows : data.mappingRows)
      setFieldOptions(data.availableFields)
      setMappingOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : '매핑 조회 실패')
    } finally {
      setBusy(false)
    }
  }

  async function saveMapping() {
    if (!token || !importSessionId) {
      return
    }
    const columnMapping: Record<string, string> = {}
    for (const row of mappingRows) {
      if (row.destinationField && row.destinationField !== IGNORE_VALUE) {
        columnMapping[row.colKey] = row.destinationField
      }
    }
    setBusy(true)
    setError(null)
    try {
      const res = await updateImportMapping(token, importSessionId, {
        columnMapping,
        conversationId,
      })
      setConversationId(res.conversationId)
      setMessages((prev) => [...prev, ...res.messages])
      setMappingOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '매핑 저장 실패')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm(card: Extract<AiAssistantMessage, { kind: 'import_preview_card' }>) {
    if (!token || !importSessionId || busy) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await confirmAiImportCommit(token, card.preview.confirmationId, {
        importSessionId,
        previewVersionHash: card.preview.previewVersionHash,
        duplicatePolicy: card.preview.duplicatePolicy,
      })
      const summary = result.summary ?? {}
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          kind: 'import_commit_result_card',
          text: '고객 등록이 완료되었습니다.',
          summary,
          customerListPath: '/customers',
        },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록 실패')
    } finally {
      setBusy(false)
    }
  }

  if (!isGaDesigner) {
    return (
      <div className="ai-secretary-page">
        <h1>ONE FC AI 비서</h1>
        <p>GA 설계사 계정에서 이용할 수 있습니다.</p>
      </div>
    )
  }

  const rootClass =
    variant === 'panel' ? 'ai-secretary-page ai-secretary-page--panel' : 'ai-secretary-page ai-secretary-page--full'

  return (
    <div className={rootClass}>
      <header className="ai-secretary-page__header">
        <h1>ONE FC AI 비서</h1>
        {variant === 'panel' ? (
          <div className="ai-secretary-page__header-actions">
            <FormButton htmlType="button" variant="secondary" onClick={() => openFullPage()}>
              전체 화면
            </FormButton>
            {onClose ? (
              <FormButton htmlType="button" variant="secondary" onClick={onClose}>
                닫기
              </FormButton>
            ) : null}
          </div>
        ) : null}
      </header>
      <div
        className="ai-secretary-page__conversation"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {dragActive ? (
          <div className="ai-secretary-drop-overlay" aria-hidden="true">
            파일을 여기에 놓아 첨부하세요
          </div>
        ) : null}
        <div className="ai-secretary-page__messages" aria-live="polite">
        {messages.map((msg, index) => {
          if (msg.kind === 'import_preview_card') {
            const s = msg.preview.summary
            const total = s.totalCandidates ?? s.totalSourceRows ?? 0
            const plannedCreate = s.plannedCreate ?? s.autoEligible ?? 0
            const isUnstructured = msg.preview.importSourceMode === UNSTRUCTURED_SOURCE_MODE
            return (
              <div key={index} className="ai-secretary-card">
                <strong>{msg.text}</strong>
                <p className="ai-secretary-card__meta">파일: {msg.preview.fileName ?? '—'}</p>
                <dl className="ai-secretary-card__stats">
                  <div><dt>전체 고객 후보</dt><dd>{total}명</dd></div>
                  <div><dt>등록 예정</dt><dd>{plannedCreate}명</dd></div>
                  <div><dt>확인 필요</dt><dd>{s.reviewRequired ?? 0}명</dd></div>
                  <div><dt>중복 제외</dt><dd>{s.duplicateSkipped ?? 0}명</dd></div>
                  <div><dt>오류</dt><dd>{s.invalid ?? 0}명</dd></div>
                </dl>
                {msg.statusLabel ? <p className="ai-secretary-status">{msg.statusLabel}</p> : null}
                {plannedCreate === 0 ? (
                  <p className="ai-secretary-status">등록 가능한 고객이 없습니다. 세부내역에서 확인이 필요한 항목을 검토해 주세요.</p>
                ) : null}
                <div className="ai-secretary-card__actions">
                  <FormButton
                    htmlType="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setIssueRows(msg.issueRows ?? [])
                      setIssueOpen(true)
                    }}
                  >
                    {isUnstructured ? '인식 결과 보기' : '세부내역'}
                  </FormButton>
                  {!isUnstructured ? (
                    <FormButton
                      htmlType="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void openMappingDetail(msg)}
                    >
                      컬럼 연결
                    </FormButton>
                  ) : null}
                  {plannedCreate > 0 ? (
                    <FormButton
                      htmlType="button"
                      variant="primary"
                      disabled={busy}
                      onClick={() => void handleConfirm(msg)}
                    >
                      {plannedCreate}명 등록
                    </FormButton>
                  ) : null}
                </div>
              </div>
            )
          }
          if (msg.kind === 'import_commit_result_card') {
            return (
              <div key={index} className="ai-secretary-card ai-secretary-card--result">
                <strong>{msg.text}</strong>
                <dl className="ai-secretary-card__stats">
                  <div><dt>요청</dt><dd>{msg.summary.requested ?? 0}</dd></div>
                  <div><dt>등록</dt><dd>{msg.summary.created ?? 0}</dd></div>
                  <div><dt>중복 제외</dt><dd>{msg.summary.skipped ?? 0}</dd></div>
                  <div><dt>실패</dt><dd>{msg.summary.failed ?? 0}</dd></div>
                </dl>
                {msg.customerListPath ? (
                  <Link className="ai-secretary-link" to={msg.customerListPath}>등록된 고객 보기</Link>
                ) : null}
              </div>
            )
          }
          if (msg.kind === 'import_analysis_progress') {
            const p = msg.progress ?? {}
            const planned = p.semanticGptPlanned ?? 0
            const attempts = p.semanticGptAttempts ?? 0
            const blocks = p.totalBlocks ?? 0
            return (
              <div key={index} className="ai-secretary-card ai-secretary-card--progress">
                <strong>{msg.text}</strong>
                <p className="ai-secretary-status">{msg.displayPhase ?? '분석 중…'}</p>
                {blocks > 0 ? (
                  <p className="ai-secretary-card__meta">✓ {blocks}개 데이터 블록 확인</p>
                ) : null}
                {planned > 0 ? (
                  <p className="ai-secretary-card__meta">
                    AI 의미 분석 {attempts} / {planned}
                  </p>
                ) : null}
              </div>
            )
          }
          if (msg.kind === 'status') {
            return (
              <p key={index} className="ai-secretary-status">{msg.text}</p>
            )
          }
          if (
            msg.role === 'assistant' &&
            (msg.kind === 'customer_summary_card' ||
              msg.kind === 'consultation_list_card' ||
              msg.kind === 'customer_files_card' ||
              msg.kind === 'task_list_card' ||
              msg.kind === 'schedule_list_card' ||
              msg.kind === 'claim_list_card' ||
              msg.kind === 'customer_disambiguation')
          ) {
            const customerId = msg.customer?.customerId
            return (
              <div key={index} className="ai-secretary-card">
                <strong className="ai-secretary-bubble ai-secretary-bubble--assistant">{msg.text}</strong>
                {msg.kind === 'customer_disambiguation' && msg.options?.length ? (
                  <div className="ai-secretary-card__actions">
                    {msg.options.map((opt) => (
                      <FormButton
                        key={opt.customerId}
                        htmlType="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void handleSend(`${opt.label} 고객 보여줘`)}
                      >
                        {opt.label}
                      </FormButton>
                    ))}
                  </div>
                ) : null}
                {msg.kind === 'customer_files_card' && msg.files?.length && customerId ? (
                  <div className="ai-secretary-card__actions">
                    <Link className="ai-secretary-link" to={`/customers/${customerId}/files`}>
                      파일함에서 보기
                    </Link>
                  </div>
                ) : null}
                {customerId ? (
                  <div className="ai-secretary-card__actions">
                    <FormButton
                      htmlType="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => navigate(`/customers?customerId=${customerId}`)}
                    >
                      고객 상세 열기
                    </FormButton>
                  </div>
                ) : null}
              </div>
            )
          }
          return (
            <div key={index} className={`ai-secretary-bubble ai-secretary-bubble--${msg.role}`}>
              {msg.text}
            </div>
          )
        })}
        {busy ? <p className="ai-secretary-status">처리 중…</p> : null}
        {error ? <p className="ai-secretary-error">{error}</p> : null}
        </div>
      </div>
      <div className="ai-secretary-suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="ai-secretary-suggestion" onClick={() => void handleSend(s)}>
            {s}
          </button>
        ))}
      </div>
      {attachment ? (
        <div
          className={[
            'ai-secretary-attachment',
            attachment.status === 'error' ? 'ai-secretary-attachment--error' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <span>
            {attachment.name}
            {attachment.status === 'uploading' ? ' (업로드 중…)' : ''}
            {attachment.status === 'error' && attachment.errorMessage ? ` — ${attachment.errorMessage}` : ''}
          </span>
          <button
            type="button"
            className="ai-secretary-attachment__remove"
            aria-label="첨부 제거"
            onClick={clearAttachment}
          >
            ×
          </button>
        </div>
      ) : null}
      <footer className="ai-secretary-composer">
        <button
          type="button"
          className="ai-secretary-attach"
          aria-label="파일 첨부"
          onClick={() => fileRef.current?.click()}
        >
          +
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          onChange={(e) => handleFileInputChange(e.target.files?.[0] ?? null)}
        />
        <input
          className="ai-secretary-input"
          placeholder="무엇을 도와드릴까요?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
        />
        <FormButton htmlType="button" variant="primary" disabled={busy} onClick={() => void handleSend()}>
          ↑
        </FormButton>
      </footer>

      {mappingOpen ? (
        <div className="ai-secretary-modal-backdrop" role="presentation" onClick={() => setMappingOpen(false)}>
          <div className="ai-secretary-modal card" onClick={(e) => e.stopPropagation()}>
            <h2>컬럼 연결</h2>
            <table className="ai-secretary-mapping-table">
              <thead>
                <tr>
                  <th>원본 컬럼</th>
                  <th>ONE FC 필드</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {mappingRows.map((row) => (
                  <tr key={row.colKey}>
                    <td>{row.sourceColumn}</td>
                    <td>
                      <select
                        className="field__control"
                        value={row.destinationField ?? IGNORE_VALUE}
                        onChange={(e) => {
                          const value = e.target.value
                          setMappingRows((prev) =>
                            prev.map((r) =>
                              r.colKey === row.colKey
                                ? {
                                    ...r,
                                    destinationField: value === IGNORE_VALUE ? null : value,
                                    destinationLabel:
                                      fieldOptions.find((f) => f.key === value)?.label ?? r.destinationLabel,
                                    status: value === IGNORE_VALUE ? 'ignored' : 'confirmed',
                                  }
                                : r,
                            ),
                          )
                        }}
                      >
                        <option value={IGNORE_VALUE}>제외</option>
                        {fieldOptions.map((f) => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>{mappingStatusLabel(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ai-secretary-modal__actions">
              <FormButton htmlType="button" variant="secondary" onClick={() => setMappingOpen(false)}>
                취소
              </FormButton>
              <FormButton htmlType="button" variant="primary" disabled={busy} onClick={() => void saveMapping()}>
                저장 후 미리보기 갱신
              </FormButton>
            </div>
          </div>
        </div>
      ) : null}

      {issueOpen ? (
        <div className="ai-secretary-modal-backdrop" role="presentation" onClick={() => setIssueOpen(false)}>
          <div className="ai-secretary-modal card" onClick={(e) => e.stopPropagation()}>
            <h2>확인·제외 항목</h2>
            <ul className="ai-secretary-issue-list">
              {(issueRows ?? []).length === 0 ? (
                <li>표시할 항목이 없습니다.</li>
              ) : (
                issueRows?.map((row) => {
                  const preview = row.mappedPreview
                  const statusKey = row.finalStatus ?? preview?.finalStatus ?? 'REVIEW_REQUIRED'
                  const userReasons = row.userReasons ?? preview?.userReasons ?? []
                  const displayName = preview?.name ?? row.identifier
                  return (
                    <li key={`${row.sourceRowNumber}-${row.identifier}`} className="ai-secretary-issue-item">
                      <p className="ai-secretary-issue-item__title">
                        {displayName}
                        {row.phoneMasked || preview?.phoneMasked ? ` · ${row.phoneMasked ?? preview?.phoneMasked}` : ''}
                      </p>
                      <dl className="ai-secretary-issue-item__fields">
                        {preview?.address ? <div><dt>주소</dt><dd>{preview.address}</dd></div> : null}
                        {preview?.job ? <div><dt>직업</dt><dd>{preview.job}</dd></div> : null}
                        {preview?.carNumber ? <div><dt>차량번호</dt><dd>{preview.carNumber}</dd></div> : null}
                      </dl>
                      <p className="ai-secretary-issue-item__status">
                        상태: {PREVIEW_FINAL_STATUS_LABEL[statusKey] ?? '확인 필요'}
                      </p>
                      {userReasons.length > 0 ? (
                        <ul className="ai-secretary-issue-item__reasons">
                          {userReasons.map((r) => (
                            <li key={r.code}>{r.message}</li>
                          ))}
                        </ul>
                      ) : null}
                      {preview?.sourceCell ? (
                        <p className="ai-secretary-issue-item__source">원본 위치: {preview.sourceCell}</p>
                      ) : (
                        <p className="ai-secretary-issue-item__source">원본 행: {row.sourceRowNumber}</p>
                      )}
                    </li>
                  )
                })
              )}
            </ul>
            <FormButton htmlType="button" variant="secondary" onClick={() => setIssueOpen(false)}>
              닫기
            </FormButton>
          </div>
        </div>
      ) : null}
    </div>
  )
}

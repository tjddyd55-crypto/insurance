import { FormButton, FormSelect, FormTextarea } from '../../../components/form'
import { Fragment, useCallback, useEffect, useState } from 'react'
import {
  createAdminFeatureRequestComment,
  listAdminFeatureRequestComments,
  listFeatureRequestsAdmin,
  updateFeatureRequestStatus,
  type FeatureRequestAdminRow,
  type FeatureRequestComment,
  type FeatureRequestStatus,
} from '../../auth/authApi'
import { useAuth } from '../../auth/AuthProvider'
import { formatKstDateDisplay, formatKstDateTimeDisplay } from '../../../utils/displayDateTime'
import {
  formatFeatureRequestAuthor,
  formatFeatureRequestCommentAuthor,
} from '../formatFeatureRequestAuthor.js'
import '../featureRequestAdmin.css'

/*
 * 기능 요청(문의/요청) 관리 — SUPER_ADMIN 전용.
 *
 * 구조 개요:
 *   - PC: 테이블 (작성자 = 소속 / 이름)
 *   - 모바일: 카드형 (가로 스크롤 표 제거)
 *   - 상세 패널: 코멘트 목록 + 답변 작성 (요청 작성자에게 노출)
 */

const STATUS_OPTIONS: { value: FeatureRequestStatus; label: string }[] = [
  { value: 'pending', label: '대기 (pending)' },
  { value: 'reviewed', label: '검토됨 (reviewed)' },
  { value: 'done', label: '완료 (done)' },
]

function formatDate(iso: string): string {
  return formatKstDateDisplay(iso, '—')
}

function formatDateTime(iso: string): string {
  return formatKstDateTimeDisplay(iso, '—')
}

function statusToLabel(status: FeatureRequestStatus): string {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status
}

function authorLabel(row: FeatureRequestAdminRow): string {
  return formatFeatureRequestAuthor({
    gaName: row.ga_name,
    userName: row.user_name,
    username: row.username,
  })
}

function CommentPanel({
  requestId,
  comments,
  commentsLoading,
  draft,
  commentBusy,
  onDraftChange,
  onSubmit,
}: {
  requestId: number
  comments: FeatureRequestComment[]
  commentsLoading: boolean
  draft: string
  commentBusy: boolean
  onDraftChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <div className="feature-request-admin__comments" id={`comments-${requestId}`}>
      <div className="feature-request-admin__comments-title">코멘트</div>
      {commentsLoading ? (
        <div className="feature-request-admin__muted">불러오는 중…</div>
      ) : comments.length === 0 ? (
        <div className="feature-request-admin__muted">아직 작성된 코멘트가 없습니다.</div>
      ) : (
        <ul className="feature-request-admin__comment-list">
          {comments.map((c) => (
            <li
              key={c.id}
              className={
                c.authorRole === 'admin'
                  ? 'feature-request-admin__comment feature-request-admin__comment--admin'
                  : 'feature-request-admin__comment'
              }
            >
              <div className="feature-request-admin__comment-meta">
                {formatFeatureRequestCommentAuthor(c)} · {formatDateTime(c.createdAt)}
              </div>
              <div className="feature-request-admin__comment-body">{c.content}</div>
            </li>
          ))}
        </ul>
      )}

      <div className="feature-request-admin__compose">
        <FormTextarea
          className="w-full text-sm"
          rows={2}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="요청자에게 전달할 답변을 입력하세요. (요청자 화면에 표시됩니다)"
          maxLength={4000}
        />
        <div>
          <FormButton
            htmlType="button"
            variant="primary"
            loading={commentBusy}
            disabled={!draft.trim()}
            onClick={() => onSubmit()}
          >
            답변 등록
          </FormButton>
        </div>
      </div>
    </div>
  )
}

export default function FeatureRequestsAdminPage() {
  const { user, token } = useAuth()
  const [rows, setRows] = useState<FeatureRequestAdminRow[]>([])
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [commentsById, setCommentsById] = useState<Record<number, FeatureRequestComment[]>>({})
  const [commentsLoadingId, setCommentsLoadingId] = useState<number | null>(null)
  const [commentDraftById, setCommentDraftById] = useState<Record<number, string>>({})
  const [commentBusyId, setCommentBusyId] = useState<number | null>(null)
  const [rowNoticeById, setRowNoticeById] = useState<Record<number, string>>({})

  const load = useCallback(async () => {
    if (!token?.trim() || user?.role !== 'SUPER_ADMIN') {
      return
    }
    setError('')
    try {
      const list = await listFeatureRequestsAdmin(token)
      setRows(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    }
  }, [token, user?.role])

  useEffect(() => {
    void load()
  }, [load])

  const flashRowNotice = useCallback((id: number, message: string) => {
    setRowNoticeById((prev) => ({ ...prev, [id]: message }))
    window.setTimeout(() => {
      setRowNoticeById((prev) => {
        if (prev[id] !== message) {
          return prev
        }
        const next = { ...prev }
        delete next[id]
        return next
      })
    }, 4000)
  }, [])

  const onStatusChange = async (id: number, nextStatus: FeatureRequestStatus) => {
    if (!token?.trim()) {
      return
    }
    const previous = rows.find((r) => r.id === id)?.status
    if (!previous || previous === nextStatus) {
      return
    }
    setUpdatingId(id)
    setError('')
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)))
    try {
      await updateFeatureRequestStatus(token, id, nextStatus)
      flashRowNotice(id, `상태를 "${statusToLabel(nextStatus)}" 로 변경했습니다.`)
    } catch (e) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: previous } : r)))
      console.error('[feature-request-admin] 상태 변경 실패', e)
      setError(e instanceof Error ? e.message : '상태 변경에 실패했습니다.')
    } finally {
      setUpdatingId(null)
    }
  }

  const loadComments = useCallback(
    async (id: number) => {
      if (!token?.trim()) {
        return
      }
      setCommentsLoadingId(id)
      try {
        const list = await listAdminFeatureRequestComments(token, id)
        setCommentsById((prev) => ({ ...prev, [id]: list }))
      } catch (e) {
        console.error('[feature-request-admin] 코멘트 조회 실패', e)
        setError(e instanceof Error ? e.message : '코멘트를 불러오지 못했습니다.')
      } finally {
        setCommentsLoadingId(null)
      }
    },
    [token],
  )

  const toggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (!commentsById[id]) {
      await loadComments(id)
    }
  }

  const onSubmitComment = async (id: number) => {
    if (!token?.trim()) {
      return
    }
    const draft = (commentDraftById[id] ?? '').trim()
    if (!draft) {
      return
    }
    setCommentBusyId(id)
    setError('')
    try {
      const created = await createAdminFeatureRequestComment(token, id, draft)
      setCommentsById((prev) => ({
        ...prev,
        [id]: [...(prev[id] ?? []), created],
      }))
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, comment_count: Math.max(r.comment_count, 0) + 1 } : r,
        ),
      )
      setCommentDraftById((prev) => ({ ...prev, [id]: '' }))
      flashRowNotice(id, '코멘트를 등록했습니다. 요청자 화면에도 표시됩니다.')
    } catch (e) {
      console.error('[feature-request-admin] 코멘트 작성 실패', e)
      const message = e instanceof Error ? e.message : '코멘트 등록에 실패했습니다.'
      setError(
        message === 'DB_ERROR'
          ? '답변 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
          : message,
      )
    } finally {
      setCommentBusyId(null)
    }
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <h1>기능 요청 관리</h1>
          <p>전체 관리자만 접근할 수 있습니다.</p>
        </header>
      </main>
    )
  }

  const renderCommentToggle = (r: FeatureRequestAdminRow, isExpanded: boolean, comments: FeatureRequestComment[]) => {
    const count = comments.length > 0 ? comments.length : r.comment_count
    return (
      <FormButton
        htmlType="button"
        variant="secondary"
        onClick={() => void toggleExpand(r.id)}
        aria-expanded={isExpanded}
        aria-controls={`comments-${r.id}`}
      >
        {isExpanded ? '접기' : count > 0 ? `코멘트 (${count})` : '코멘트'}
      </FormButton>
    )
  }

  return (
    <main className="page page--with-back feature-request-admin">
      <header className="page-header">
        <h1>기능 요청 관리</h1>
        <p>{error || `총 ${rows.length}건 (최근 500건)`}</p>
      </header>

      {/* 모바일 카드 */}
      <div className="feature-request-admin__cards" aria-label="기능 요청 목록 (모바일)">
        {rows.length === 0 ? (
          <div className="feature-request-admin__empty">등록된 요청이 없습니다.</div>
        ) : (
          rows.map((r) => {
            const isExpanded = expandedId === r.id
            const comments = commentsById[r.id] ?? []
            const draft = commentDraftById[r.id] ?? ''
            const rowNotice = rowNoticeById[r.id]
            return (
              <article key={r.id} className="feature-request-admin__card">
                <h2 className="feature-request-admin__card-title">{r.title || '(제목 없음)'}</h2>
                <div className="feature-request-admin__card-meta">
                  <span>{authorLabel(r)}</span>
                  <span>·</span>
                  <span>{statusToLabel(r.status)}</span>
                  <span>·</span>
                  <span className="tabular-nums">{formatDate(r.created_at)}</span>
                </div>
                <p className="feature-request-admin__card-content">{r.content}</p>
                <div className="feature-request-admin__card-actions">
                  <FormSelect
                    value={r.status}
                    disabled={updatingId === r.id}
                    onChange={(e) => {
                      void onStatusChange(r.id, e.target.value as FeatureRequestStatus)
                    }}
                    aria-label={`${r.id} 상태`}
                    options={STATUS_OPTIONS}
                  />
                  {renderCommentToggle(r, isExpanded, comments)}
                </div>
                {rowNotice ? (
                  <div className="feature-request-admin__notice" role="status" aria-live="polite">
                    {rowNotice}
                  </div>
                ) : null}
                {isExpanded ? (
                  <CommentPanel
                    requestId={r.id}
                    comments={comments}
                    commentsLoading={commentsLoadingId === r.id && !commentsById[r.id]}
                    draft={draft}
                    commentBusy={commentBusyId === r.id}
                    onDraftChange={(value) =>
                      setCommentDraftById((prev) => ({ ...prev, [r.id]: value }))
                    }
                    onSubmit={() => void onSubmitComment(r.id)}
                  />
                ) : null}
              </article>
            )
          })
        )}
      </div>

      {/* PC 테이블 */}
      <div className="feature-request-admin__table-wrap card">
        <table className="feature-request-admin__table">
          <thead>
            <tr>
              <th>GA</th>
              <th>작성자</th>
              <th>제목</th>
              <th>내용</th>
              <th>상태</th>
              <th>작성일</th>
              <th>코멘트</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="feature-request-admin__empty-cell">
                  등록된 요청이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const isExpanded = expandedId === r.id
                const comments = commentsById[r.id] ?? []
                const draft = commentDraftById[r.id] ?? ''
                const rowNotice = rowNoticeById[r.id]
                return (
                  <Fragment key={r.id}>
                    <tr>
                      <td className="feature-request-admin__nowrap">{r.ga_name}</td>
                      <td className="feature-request-admin__author">{authorLabel(r)}</td>
                      <td className="feature-request-admin__title-cell">{r.title || '—'}</td>
                      <td className="feature-request-admin__content-cell">{r.content}</td>
                      <td>
                        <FormSelect
                          value={r.status}
                          disabled={updatingId === r.id}
                          onChange={(e) => {
                            void onStatusChange(r.id, e.target.value as FeatureRequestStatus)
                          }}
                          aria-label={`${r.id} 상태`}
                          options={STATUS_OPTIONS}
                        />
                        {rowNotice ? (
                          <div className="feature-request-admin__notice" role="status" aria-live="polite">
                            {rowNotice}
                          </div>
                        ) : null}
                      </td>
                      <td className="tabular-nums">{formatDate(r.created_at)}</td>
                      <td>{renderCommentToggle(r, isExpanded, comments)}</td>
                    </tr>
                    {isExpanded ? (
                      <tr>
                        <td colSpan={7} className="feature-request-admin__expand-cell">
                          <CommentPanel
                            requestId={r.id}
                            comments={comments}
                            commentsLoading={commentsLoadingId === r.id && !commentsById[r.id]}
                            draft={draft}
                            commentBusy={commentBusyId === r.id}
                            onDraftChange={(value) =>
                              setCommentDraftById((prev) => ({ ...prev, [r.id]: value }))
                            }
                            onSubmit={() => void onSubmitComment(r.id)}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}

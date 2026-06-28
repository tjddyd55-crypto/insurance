import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { FormButton, FormInput, FormSelect } from '../../../components/form'
import { fetchSecurityAuditLogs, type SecurityAuditLogRow } from '../../auth/authApi'
import { useAuth } from '../../auth/AuthProvider'
import AdminPageShell from '../components/layout/AdminPageShell'
import { AuditLogDetailModal } from '../components/AuditLogDetailModal'
import {
  AUDIT_LOG_ACTION_FILTER_OPTIONS,
  AUDIT_LOG_TABS,
  buildAuditLogQueryParams,
  formatAuditLogDateTime,
  getAuditRowActionLabel,
  getAuditRowActorLabel,
  getAuditRowRoleLabel,
  getAuditRowSummary,
  getAuditRowTargetLabel,
  type AuditLogActionFilter,
  type AuditLogCategory,
} from '../auditLogs/auditLogPresentation'
import '../admin-ui.css'

export default function AuditLogsPage() {
  const { token } = useAuth()
  const [rows, setRows] = useState<SecurityAuditLogRow[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tabCategory, setTabCategory] = useState<AuditLogCategory>('all')
  const [actionFilter, setActionFilter] = useState<AuditLogActionFilter>('')
  const [actorFilter, setActorFilter] = useState('')
  const [sinceFilter, setSinceFilter] = useState('')
  const [detailRow, setDetailRow] = useState<SecurityAuditLogRow | null>(null)

  const load = useCallback(async () => {
    if (!token?.trim()) {
      return
    }
    setLoading(true)
    setError('')
    try {
      const params = buildAuditLogQueryParams({
        limit: 50,
        tabCategory,
        actionFilter,
        actorQ: actorFilter,
        since: sinceFilter,
      })
      const list = await fetchSecurityAuditLogs(token, params)
      setRows(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token, tabCategory, actionFilter, actorFilter, sinceFilter])

  useEffect(() => {
    if (!token?.trim()) {
      return
    }
    void load()
  }, [token, tabCategory]) // eslint-disable-line react-hooks/exhaustive-deps -- 탭 변경 시 자동 조회

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void load()
  }

  return (
    <AdminPageShell
      title="보안 감사 로그"
      description="관리자 활동 기록입니다. 비밀번호·토큰 등 민감 정보는 저장·표시하지 않습니다."
      tabs={AUDIT_LOG_TABS}
      activeTabId={tabCategory}
      onTabChange={(tabId) => setTabCategory(tabId as AuditLogCategory)}
      className="audit-logs-page"
    >
      <form className="admin-data-card audit-logs-page__filters" onSubmit={onSubmit}>
        <div className="audit-logs-page__filter-grid">
          <label className="field audit-logs-page__field">
            <span className="field__label">작업 유형</span>
            <FormSelect
              className="field__control"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as AuditLogActionFilter)}
            >
              {AUDIT_LOG_ACTION_FILTER_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FormSelect>
          </label>
          <label className="field audit-logs-page__field">
            <span className="field__label">사용자</span>
            <FormInput
              className="field__control"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              placeholder="아이디 또는 이름"
            />
          </label>
          <label className="field audit-logs-page__field">
            <span className="field__label">기간 시작</span>
            <FormInput
              className="field__control"
              value={sinceFilter}
              onChange={(e) => setSinceFilter(e.target.value)}
              placeholder="예: 2026-06-01"
            />
          </label>
          <div className="audit-logs-page__filter-actions">
            <FormButton htmlType="submit" variant="primary" disabled={loading}>
              {loading ? '조회 중…' : '조회'}
            </FormButton>
            <FormButton htmlType="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              새로고침
            </FormButton>
          </div>
        </div>
      </form>

      {error ? <p className="status status--error">{error}</p> : null}

      <div className="admin-data-card audit-logs-page__results">
        <div className="audit-logs-table-wrap admin-data-table-wrap">
          <table className="admin-data-table audit-logs-table">
            <thead>
              <tr>
                <th>시간</th>
                <th>작업</th>
                <th>사용자</th>
                <th>권한</th>
                <th>대상</th>
                <th>내용</th>
                <th className="admin-table-cell--actions">상세</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="audit-logs-table__empty">
                    {loading ? '불러오는 중…' : '내역이 없습니다. 필터를 조정하거나 조회를 누르세요.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={String(row.id)}>
                    <td className="audit-logs-table__time">{formatAuditLogDateTime(row.occurredAt ?? row.created_at)}</td>
                    <td>{getAuditRowActionLabel(row)}</td>
                    <td>{getAuditRowActorLabel(row)}</td>
                    <td>{getAuditRowRoleLabel(row)}</td>
                    <td>{getAuditRowTargetLabel(row)}</td>
                    <td className="audit-logs-table__summary">{getAuditRowSummary(row)}</td>
                    <td className="admin-table-cell--actions">
                      <FormButton htmlType="button" variant="secondary" size="sm" onClick={() => setDetailRow(row)}>
                        보기
                      </FormButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="audit-logs-cards" aria-label="감사 로그 목록">
          {rows.length === 0 ? (
            <p className="audit-logs-cards__empty">
              {loading ? '불러오는 중…' : '내역이 없습니다. 필터를 조정하거나 조회를 누르세요.'}
            </p>
          ) : (
            rows.map((row) => (
              <article key={String(row.id)} className="audit-log-card">
                <div className="audit-log-card__head">
                  <strong className="audit-log-card__action">{getAuditRowActionLabel(row)}</strong>
                  <span className="audit-log-card__meta">
                    {getAuditRowActorLabel(row)} · {getAuditRowRoleLabel(row)}
                  </span>
                </div>
                <p className="audit-log-card__time">
                  {formatAuditLogDateTime(row.occurredAt ?? row.created_at, true)}
                </p>
                <p className="audit-log-card__summary">{getAuditRowSummary(row)}</p>
                <FormButton htmlType="button" variant="secondary" size="sm" onClick={() => setDetailRow(row)}>
                  상세
                </FormButton>
              </article>
            ))
          )}
        </div>
      </div>

      <AuditLogDetailModal open={detailRow != null} row={detailRow} onClose={() => setDetailRow(null)} />
    </AdminPageShell>
  )
}

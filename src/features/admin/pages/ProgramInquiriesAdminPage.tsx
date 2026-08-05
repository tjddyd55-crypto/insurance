/**
 * ONE FC 프로그램 문의 관리 — SUPER_ADMIN 전용.
 *
 * 구조:
 *   - 필터 + 목록(PC 테이블 / 모바일 카드)
 *   - 상세 FormDialog: 상태·메모·배정·스팸·소프트삭제
 *   - 신규 건수는 페이지 제목에 표시 (메뉴 배지 생략)
 */

import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { FormButton, FormInput, FormSelect, FormTextarea } from '../../../components/form'
import { FormDialog, useConfirmDialog } from '../../../components/dialog'
import { DialogActions } from '../../../components/dialog/DialogActions'
import { useAuth } from '../../auth/AuthProvider'
import AdminPageShell from '../components/layout/AdminPageShell'
import {
  listProgramInquiriesAdmin,
  patchProgramInquiryAdmin,
  type ProgramInquiryAdminRow,
  type ProgramInquiryStatus,
  type ProgramInquiryType,
} from '../api/programInquiriesAdminApi'
import {
  PROGRAM_INQUIRY_STATUS_OPTIONS,
  PROGRAM_INQUIRY_TYPE_OPTIONS,
  programInquiryContactTimeLabel,
  programInquiryStatusLabel,
  programInquiryTypeLabel,
  truncateMessage,
} from '../config/programInquiryLabels'
import { formatKstDateTimeDisplay } from '../../../utils/displayDateTime'
import '../admin-ui.css'
import './programInquiriesAdmin.css'

function formatDateTime(iso: string | null | undefined): string {
  return formatKstDateTimeDisplay(iso ?? '', '—')
}

type DetailDraft = {
  status: ProgramInquiryStatus | string
  adminMemo: string
}

export default function ProgramInquiriesAdminPage() {
  const { user, token } = useAuth()
  const { confirm, confirmDialog } = useConfirmDialog()

  const [items, setItems] = useState<ProgramInquiryAdminRow[]>([])
  const [total, setTotal] = useState(0)
  const [newCount, setNewCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [statusFilter, setStatusFilter] = useState<ProgramInquiryStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<ProgramInquiryType | ''>('')
  const [qFilter, setQFilter] = useState('')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')

  const [selected, setSelected] = useState<ProgramInquiryAdminRow | null>(null)
  const [draft, setDraft] = useState<DetailDraft | null>(null)

  const load = useCallback(
    async (pageOverride?: number) => {
      if (!token?.trim() || user?.role !== 'SUPER_ADMIN') return
      const nextPage = pageOverride ?? page
      setLoading(true)
      setError('')
      try {
        const data = await listProgramInquiriesAdmin(token, {
          status: statusFilter,
          inquiryType: typeFilter,
          q: qFilter,
          from: fromFilter,
          to: toFilter,
          page: nextPage,
          pageSize,
        })
        setItems(data.items)
        setTotal(data.total)
        setNewCount(data.newCount)
        setPage(data.page)
      } catch (e) {
        setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    },
    [token, user?.role, statusFilter, typeFilter, qFilter, fromFilter, toFilter, page, pageSize],
  )

  useEffect(() => {
    void load(1)
    // 최초 진입·역할 확인만 — 필터는 조회 버튼으로
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.role])

  const openDetail = (row: ProgramInquiryAdminRow) => {
    setSelected(row)
    setDraft({
      status: row.status,
      adminMemo: row.adminMemo ?? '',
    })
    setNotice('')
  }

  const isDirty =
    selected &&
    draft &&
    (draft.status !== selected.status || draft.adminMemo !== (selected.adminMemo ?? ''))

  const requestCloseDetail = async () => {
    if (isDirty) {
      const ok = await confirm({
        title: '변경사항 확인',
        message: '변경사항이 저장되지 않았습니다. 닫으시겠습니까?',
        confirmLabel: '닫기',
        cancelLabel: '취소',
        tone: 'danger',
      })
      if (!ok) return
    }
    setSelected(null)
    setDraft(null)
  }

  const onFilterSubmit = (e: FormEvent) => {
    e.preventDefault()
    void load(1)
  }

  const applyPatch = async (
    id: string,
    body: Parameters<typeof patchProgramInquiryAdmin>[2],
    successMessage: string,
  ) => {
    if (!token?.trim()) return false
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await patchProgramInquiryAdmin(token, id, body)
      if ('deleted' in result && result.deleted) {
        setSelected(null)
        setDraft(null)
        setNotice(successMessage)
        await load()
        return true
      }
      const row = result as ProgramInquiryAdminRow
      setSelected(row)
      setDraft({ status: row.status, adminMemo: row.adminMemo ?? '' })
      setItems((prev) => prev.map((r) => (r.id === row.id ? row : r)))
      setNotice(successMessage)
      if (body.status != null || body.softDelete) {
        await load()
      }
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const onSaveDetail = async () => {
    if (!selected || !draft) return
    await applyPatch(
      selected.id,
      {
        status: draft.status as ProgramInquiryStatus,
        adminMemo: draft.adminMemo,
      },
      '저장했습니다.',
    )
  }

  const onAssignMe = async () => {
    if (!selected || !user?.id) return
    await applyPatch(selected.id, { assignedAdminId: user.id }, '나에게 배정했습니다.')
  }

  const onClearAssignee = async () => {
    if (!selected) return
    await applyPatch(selected.id, { assignedAdminId: null }, '배정을 해제했습니다.')
  }

  const onMarkSpam = async () => {
    if (!selected || !draft) return
    const ok = await confirm({
      title: '스팸 처리',
      message: '이 문의를 스팸으로 표시할까요?',
      confirmLabel: '스팸 처리',
      tone: 'danger',
    })
    if (!ok) return
    setDraft((d) => (d ? { ...d, status: 'SPAM' } : d))
    await applyPatch(selected.id, { status: 'SPAM', adminMemo: draft.adminMemo }, '스팸으로 표시했습니다.')
  }

  const onSoftDelete = async () => {
    if (!selected) return
    const ok = await confirm({
      title: '문의 삭제',
      message: '이 문의를 목록에서 숨길까요? (소프트 삭제)',
      confirmLabel: '삭제',
      tone: 'danger',
    })
    if (!ok) return
    await applyPatch(selected.id, { softDelete: true }, '문의를 삭제했습니다.')
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <h1>프로그램 문의</h1>
          <p>전체 관리자만 접근할 수 있습니다.</p>
        </header>
      </main>
    )
  }

  const title =
    newCount > 0 ? `프로그램 문의 (${newCount}건 신규)` : '프로그램 문의'
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <AdminPageShell
      title={title}
      description="Introduction 랜딩에서 접수된 ONE FC 프로그램 도입·이용 문의입니다."
      className="program-inquiries-admin-page"
    >
      <form className="admin-data-card program-inquiries-admin__filters" onSubmit={onFilterSubmit}>
        <div className="program-inquiries-admin__filter-grid">
          <label className="field">
            <span className="field__label">상태</span>
            <FormSelect
              className="field__control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ProgramInquiryStatus | '')}
            >
              <option value="">전체</option>
              {PROGRAM_INQUIRY_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </FormSelect>
          </label>
          <label className="field">
            <span className="field__label">문의 유형</span>
            <FormSelect
              className="field__control"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ProgramInquiryType | '')}
            >
              <option value="">전체</option>
              {PROGRAM_INQUIRY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </FormSelect>
          </label>
          <label className="field program-inquiries-admin__field--search">
            <span className="field__label">검색</span>
            <FormInput
              className="field__control"
              value={qFilter}
              onChange={(e) => setQFilter(e.target.value)}
              placeholder="이름·연락처·소속"
            />
          </label>
          <label className="field">
            <span className="field__label">시작일</span>
            <FormInput
              className="field__control"
              type="date"
              value={fromFilter}
              onChange={(e) => setFromFilter(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">종료일</span>
            <FormInput
              className="field__control"
              type="date"
              value={toFilter}
              onChange={(e) => setToFilter(e.target.value)}
            />
          </label>
          <div className="program-inquiries-admin__filter-actions">
            <FormButton htmlType="submit" variant="primary" disabled={loading}>
              {loading ? '조회 중…' : '조회'}
            </FormButton>
            <FormButton
              htmlType="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void load(page)}
            >
              새로고침
            </FormButton>
          </div>
        </div>
      </form>

      {error ? <p className="status status--error">{error}</p> : null}
      {notice && !selected ? <p className="status status--ok">{notice}</p> : null}

      <div className="admin-data-card program-inquiries-admin__results">
        <div className="program-inquiries-admin__meta">
          총 {total}건 · {page}/{totalPages} 페이지
        </div>

        <div className="admin-data-table-wrap program-inquiries-admin__table-wrap">
          <table className="admin-data-table program-inquiries-admin__table">
            <thead>
              <tr>
                <th>접수 시각</th>
                <th>상태</th>
                <th>유형</th>
                <th>이름</th>
                <th>연락처</th>
                <th>소속</th>
                <th>문의 내용</th>
                <th>담당</th>
                <th className="admin-table-cell--actions">상세</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    {loading ? '불러오는 중…' : '조건에 맞는 문의가 없습니다.'}
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.createdAt)}</td>
                    <td>
                      <span
                        className={`program-inquiries-admin__badge program-inquiries-admin__badge--${row.status.toLowerCase()}`}
                      >
                        {programInquiryStatusLabel(row.status)}
                      </span>
                    </td>
                    <td>{programInquiryTypeLabel(row.inquiryType)}</td>
                    <td>{row.name}</td>
                    <td>{row.phoneDisplay}</td>
                    <td>{row.organizationName || '—'}</td>
                    <td className="program-inquiries-admin__preview">{truncateMessage(row.message)}</td>
                    <td>{row.assignedAdminName || '—'}</td>
                    <td className="admin-table-cell--actions">
                      <FormButton
                        htmlType="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => openDetail(row)}
                      >
                        보기
                      </FormButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="program-inquiries-admin__cards" aria-label="문의 카드 목록">
          {items.length === 0 ? (
            <p className="program-inquiries-admin__muted">
              {loading ? '불러오는 중…' : '조건에 맞는 문의가 없습니다.'}
            </p>
          ) : (
            items.map((row) => (
              <article key={row.id} className="program-inquiries-admin__card">
                <div className="program-inquiries-admin__card-head">
                  <span
                    className={`program-inquiries-admin__badge program-inquiries-admin__badge--${row.status.toLowerCase()}`}
                  >
                    {programInquiryStatusLabel(row.status)}
                  </span>
                  <time>{formatDateTime(row.createdAt)}</time>
                </div>
                <h2 className="program-inquiries-admin__card-title">
                  {row.name}
                  {row.organizationName ? ` · ${row.organizationName}` : ''}
                </h2>
                <p className="program-inquiries-admin__card-meta">
                  {programInquiryTypeLabel(row.inquiryType)} · {row.phoneDisplay}
                </p>
                <p className="program-inquiries-admin__card-message">{truncateMessage(row.message, 120)}</p>
                <div className="program-inquiries-admin__card-actions">
                  <FormButton htmlType="button" variant="primary" size="sm" onClick={() => openDetail(row)}>
                    상세
                  </FormButton>
                </div>
              </article>
            ))
          )}
        </div>

        {totalPages > 1 ? (
          <div className="program-inquiries-admin__pager">
            <FormButton
              htmlType="button"
              variant="secondary"
              disabled={loading || page <= 1}
              onClick={() => void load(page - 1)}
            >
              이전
            </FormButton>
            <span>
              {page} / {totalPages}
            </span>
            <FormButton
              htmlType="button"
              variant="secondary"
              disabled={loading || page >= totalPages}
              onClick={() => void load(page + 1)}
            >
              다음
            </FormButton>
          </div>
        ) : null}
      </div>

      <FormDialog
        open={Boolean(selected && draft)}
        title="문의 상세"
        panelPreset="largeForm"
        onClose={() => void requestCloseDetail()}
        onEscapeRequest={() => void requestCloseDetail()}
        footer={
          <DialogActions>
            <FormButton htmlType="button" variant="secondary" disabled={saving} onClick={() => void requestCloseDetail()}>
              닫기
            </FormButton>
            <FormButton htmlType="button" variant="danger" disabled={saving} onClick={() => void onSoftDelete()}>
              삭제
            </FormButton>
            <FormButton htmlType="button" variant="secondary" disabled={saving} onClick={() => void onMarkSpam()}>
              스팸
            </FormButton>
            <FormButton htmlType="button" variant="primary" loading={saving} disabled={saving} onClick={() => void onSaveDetail()}>
              저장
            </FormButton>
          </DialogActions>
        }
      >
        {selected && draft ? (
          <div className="program-inquiries-admin__detail">
            {notice ? <p className="status status--ok">{notice}</p> : null}
            <dl className="program-inquiries-admin__detail-grid">
              <div>
                <dt>접수 시각</dt>
                <dd>{formatDateTime(selected.createdAt)}</dd>
              </div>
              <div>
                <dt>문의 유형</dt>
                <dd>{programInquiryTypeLabel(selected.inquiryType)}</dd>
              </div>
              <div>
                <dt>이름</dt>
                <dd>{selected.name}</dd>
              </div>
              <div>
                <dt>연락처</dt>
                <dd>
                  <a href={`tel:${selected.phoneNormalized}`}>{selected.phoneDisplay}</a>
                </dd>
              </div>
              <div>
                <dt>소속</dt>
                <dd>{selected.organizationName || '—'}</dd>
              </div>
              <div>
                <dt>이메일</dt>
                <dd>
                  {selected.email ? (
                    <a href={`mailto:${selected.email}`}>{selected.email}</a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt>연락 가능 시간</dt>
                <dd>{programInquiryContactTimeLabel(selected.preferredContactTime)}</dd>
              </div>
              <div>
                <dt>담당자</dt>
                <dd>{selected.assignedAdminName || '미배정'}</dd>
              </div>
            </dl>

            <section className="program-inquiries-admin__detail-section">
              <h3>문의 내용</h3>
              <pre className="program-inquiries-admin__message-pre">{selected.message}</pre>
            </section>

            <label className="field">
              <span className="field__label">상태</span>
              <FormSelect
                className="field__control"
                value={draft.status}
                onChange={(e) => setDraft((d) => (d ? { ...d, status: e.target.value } : d))}
              >
                {PROGRAM_INQUIRY_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </FormSelect>
            </label>

            <label className="field">
              <span className="field__label">관리자 메모</span>
              <FormTextarea
                className="field__control w-full"
                rows={4}
                maxLength={4000}
                value={draft.adminMemo}
                onChange={(e) => setDraft((d) => (d ? { ...d, adminMemo: e.target.value } : d))}
                placeholder="내부 메모 (문의자에게 노출되지 않음)"
              />
            </label>

            <div className="program-inquiries-admin__assign-actions">
              <FormButton
                htmlType="button"
                variant="secondary"
                size="sm"
                disabled={saving || selected.assignedAdminId === user?.id}
                onClick={() => void onAssignMe()}
              >
                나에게 배정
              </FormButton>
              <FormButton
                htmlType="button"
                variant="secondary"
                size="sm"
                disabled={saving || !selected.assignedAdminId}
                onClick={() => void onClearAssignee()}
              >
                배정 해제
              </FormButton>
            </div>
          </div>
        ) : null}
      </FormDialog>

      {confirmDialog}
    </AdminPageShell>
  )
}

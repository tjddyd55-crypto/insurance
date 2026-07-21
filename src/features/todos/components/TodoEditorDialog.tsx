import { useCallback, useEffect, useRef, useState } from 'react'
import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { useConfirmDialog } from '../../../components/dialog'
import { FormButton, FormInput, FormTextarea } from '../../../components/form'
import AppDateInput from '../../../components/common/AppDateInput'
import { ApiError } from '../../../lib/apiClient'
import { searchCustomers } from '../../customers/api/customersApi'
import type { CustomerRecord } from '../../customers/domain/types'
import type { TodoDto, TodoSourceType } from '../domain/todoTypes'
import { createTodo, deleteTodo, patchTodo } from '../api/todosApi'
import { formatSeoulYmd } from '../utils/formatSeoulYmd'
import { suggestDueDateFromText } from '../utils/suggestDueDateFromText'
import { firstLineTodoTitle } from '../utils/todoCopy'

const MIN_SEARCH = 2

export type TodoCreatePrefill = {
  sourceType: TodoSourceType
  sourceId?: string | null
  /** @deprecated UI에서는 사용하지 않음. description 비어 있을 때만 fallback */
  title?: string
  description: string
  dueDate?: string | null
  relatedEntityType?: 'customer' | null
  relatedEntityId?: string | null
  lockRelated?: boolean
  lockedCustomerSummary?: string
}

type Mode = 'create' | 'edit'

type Props = {
  open: boolean
  onClose: () => void
  token: string
  gaId: number | null
  prefill?: TodoCreatePrefill | null
  editingTodo?: TodoDto | null
  usePortal?: boolean
  /** 열림 세션당 증가 — 동일 고객에서 연속으로 띄울 때 폼 리셋 */
  sessionKey?: number
  onCommitted?: () => void
}

function resolveEditorContent(description: string | null | undefined, title: string | null | undefined): string {
  const content = String(description ?? '').trim()
  if (content) {
    return content
  }
  return String(title ?? '').trim()
}

export function TodoEditorDialog({
  open,
  onClose,
  token,
  gaId,
  prefill,
  editingTodo,
  usePortal = false,
  sessionKey = 0,
  onCommitted,
}: Props) {
  const { confirm, confirmDialog } = useConfirmDialog()

  const mode: Mode = editingTodo ? 'edit' : 'create'

  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [relatedEntityType, setRelatedEntityType] = useState('')
  const [relatedEntityId, setRelatedEntityId] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchHits, setSearchHits] = useState<CustomerRecord[]>([])
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const touchedRef = useRef(false)

  const nestedConfirmBlockingRef = useRef(false)

  const lockRelated = mode === 'create' ? Boolean(prefill?.lockRelated) : false
  const lockedCustomerSummary =
    mode === 'create' ? String(prefill?.lockedCustomerSummary ?? '').trim() : ''

  const resetFromEditing = useCallback((row: TodoDto) => {
    setDescription(resolveEditorContent(row.description, row.title))
    setDueDate(row.dueDate ?? '')
    setRelatedEntityType(row.relatedEntityType ?? '')
    setRelatedEntityId(row.relatedEntityId ?? '')
    setSearchQ('')
    setSearchHits([])
    setFormError('')
  }, [])

  const resetFromPrefill = useCallback((pf: TodoCreatePrefill) => {
    const content = resolveEditorContent(pf.description, pf.title)
    const suggested =
      pf.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(pf.dueDate)
        ? pf.dueDate
        : suggestDueDateFromText(content)
    setDescription(content)
    setDueDate(suggested ?? '')
    if (pf.lockRelated && pf.relatedEntityType === 'customer' && pf.relatedEntityId) {
      setRelatedEntityType('customer')
      setRelatedEntityId(pf.relatedEntityId)
    } else {
      setRelatedEntityType('')
      setRelatedEntityId('')
    }
    setSearchQ('')
    setSearchHits([])
    setFormError('')
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }
    touchedRef.current = false
    if (mode === 'edit' && editingTodo) {
      resetFromEditing(editingTodo)
    } else if (prefill) {
      resetFromPrefill(prefill)
    } else {
      setDescription('')
      setDueDate('')
      setRelatedEntityType('')
      setRelatedEntityId('')
      setSearchQ('')
      setSearchHits([])
      setFormError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionKey·id로 열림 경계만 리셋
  }, [open, sessionKey, editingTodo?.id, mode, prefill, resetFromEditing, resetFromPrefill])

  useEffect(() => {
    if (!open || !token?.trim()) {
      return
    }
    const q = searchQ.trim()
    if (lockRelated || q.length < MIN_SEARCH) {
      setSearchHits([])
      return
    }
    let cancelled = false
    setSearchBusy(true)
    const t = window.setTimeout(() => {
      void searchCustomers(token, q, { scopeGaId: gaId })
        .then((rows) => {
          if (!cancelled) {
            setSearchHits(rows.slice(0, 15))
          }
        })
        .catch(() => {
          if (!cancelled) setSearchHits([])
        })
        .finally(() => {
          if (!cancelled) setSearchBusy(false)
        })
    }, 280)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [open, token, gaId, searchQ, lockRelated])

  const suggestFromDescription = () => {
    touchedRef.current = true
    const s = suggestDueDateFromText(description)
    if (s && !dueDate) {
      setDueDate(s)
    }
  }

  const handleRequestClose = useCallback(async () => {
    if (nestedConfirmBlockingRef.current) {
      return
    }
    if (touchedRef.current) {
      nestedConfirmBlockingRef.current = true
      const ok = await confirm({
        title: '닫기',
        message: '변경사항이 저장되지 않았습니다. 닫으시겠습니까?',
        confirmLabel: '닫기',
      })
      nestedConfirmBlockingRef.current = false
      if (!ok) return
    }
    onClose()
  }, [confirm, onClose])

  async function submit() {
    if (!token?.trim()) {
      return
    }
    const content = description.trim()
    if (!content) {
      setFormError('내용을 입력해 주세요.')
      return
    }
    const title = firstLineTodoTitle(content)
    setBusy(true)
    setFormError('')
    try {
      if (mode === 'edit' && editingTodo) {
        await patchTodo(token, editingTodo.id, {
          title,
          description: content,
          dueDate: dueDate.trim() || null,
          dueTime: null,
          priority: 'normal',
          relatedEntityType: relatedEntityType.trim() || null,
          relatedEntityId: relatedEntityType.trim() && relatedEntityId.trim() ? relatedEntityId.trim() : null,
        })
      } else {
        const st: TodoSourceType = prefill?.sourceType ?? 'manual'
        await createTodo(token, {
          sourceType: st,
          sourceId: prefill?.sourceId ?? undefined,
          title,
          description: content,
          dueDate: dueDate.trim() || null,
          dueTime: null,
          priority: 'normal',
          relatedEntityType: relatedEntityType.trim() ? relatedEntityType.trim() : null,
          relatedEntityId:
            relatedEntityType.trim() && relatedEntityId.trim() ? relatedEntityId.trim() : null,
        })
      }
      onCommitted?.()
      onClose()
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : '저장에 실패했습니다.'
      setFormError(msg)
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!token?.trim() || !editingTodo) return
    const ok = await confirm({
      title: '할 일 삭제',
      message: '삭제 후에는 복구할 수 없습니다. 계속하시겠습니까?',
      confirmLabel: '삭제',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    setFormError('')
    try {
      await deleteTodo(token, editingTodo.id)
      onCommitted?.()
      onClose()
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : '삭제에 실패했습니다.'
      setFormError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <BaseDialog
        open={open}
        onClose={() => void handleRequestClose()}
        ariaLabel={mode === 'edit' ? '할 일 수정' : '할 일 추가'}
        panelPreset="largeForm"
        closeOnBackdrop={false}
        closeOnHistoryBack
        usePortal={usePortal}
        onEscapeRequest={() => void handleRequestClose()}
      >
        <div className="todo-editor-dialog flex flex-col flex-1 min-h-0 text-[var(--text-primary)]">
          <header className="flex-shrink-0 border-b border-[var(--border-default)] px-4 py-3">
            <h2 className="text-lg font-semibold m-0">{mode === 'edit' ? '할 일 수정' : '할 일 추가'}</h2>
          </header>
          <div className="todo-editor-dialog__body flex-1 min-h-0 overflow-y-auto px-4 py-3">
            {formError ? (
              <p className="text-sm text-[var(--danger,#ef4444)] m-0" role="alert">
                {formError}
              </p>
            ) : null}
            <label className="todo-editor-dialog__field">
              <span className="todo-editor-dialog__label">내용</span>
              <FormTextarea
                value={description}
                rows={6}
                placeholder="할 일을 입력하세요."
                onChange={(e) => {
                  touchedRef.current = true
                  setDescription(e.target.value.slice(0, 20000))
                }}
                disabled={busy}
              />
              <button
                type="button"
                className="todo-editor-dialog__suggest-link"
                disabled={busy}
                onClick={suggestFromDescription}
              >
                본문에서 오늘/내일/모레 키워드로 마감일 제안
              </button>
            </label>
            <label className="todo-editor-dialog__field">
              <span className="todo-editor-dialog__label">마감일</span>
              <AppDateInput
                value={dueDate}
                onChange={(value) => {
                  touchedRef.current = true
                  setDueDate(value)
                }}
                disabled={busy}
              />
            </label>
            {mode === 'create' && lockRelated ? (
              <div className="todo-editor-dialog__locked rounded-lg border border-[var(--border-default)] bg-[var(--bg-soft)] p-3 text-sm">
                <div className="todo-editor-dialog__label mb-1">연결 대상</div>
                {relatedEntityType === 'customer' && relatedEntityId ? (
                  <div>
                    고객{lockedCustomerSummary ? ` (${lockedCustomerSummary})` : ''} · ID {relatedEntityId}
                  </div>
                ) : (
                  <div className="text-[var(--text-muted)]">연결 없음</div>
                )}
              </div>
            ) : mode === 'edit' && editingTodo?.relatedEntityType === 'customer' && editingTodo.relatedEntityId ? (
              <div className="todo-editor-dialog__locked rounded-lg border border-[var(--border-default)] bg-[var(--bg-soft)] p-3 text-sm">
                <div className="todo-editor-dialog__label mb-1">연결 고객</div>
                <div>
                  {editingTodo.customerName ? editingTodo.customerName : '고객'} · ID {editingTodo.relatedEntityId}
                </div>
              </div>
            ) : !lockRelated ? (
              <div className="todo-editor-dialog__field">
                <span className="todo-editor-dialog__label">연결 대상 — 고객 검색</span>
                <FormInput
                  value={searchQ}
                  placeholder={`이름/전화 ${MIN_SEARCH}글자 이상`}
                  onChange={(e) => {
                    touchedRef.current = true
                    setSearchQ(e.target.value)
                  }}
                  disabled={busy}
                />
                {searchBusy ? <p className="todo-editor-dialog__hint m-0">검색 중…</p> : null}
                {searchHits.length > 0 ? (
                  <ul className="todo-editor-dialog__hits m-0 p-0 list-none">
                    {searchHits.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          disabled={busy}
                          className="todo-editor-dialog__hit"
                          onClick={() => {
                            touchedRef.current = true
                            setRelatedEntityType('customer')
                            setRelatedEntityId(String(c.id))
                            setSearchHits([])
                          }}
                        >
                          {c.name} · {c.phone || '—'}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {relatedEntityType === 'customer' && relatedEntityId ? (
                  <div className="todo-editor-dialog__hint">
                    선택됨 {relatedEntityType} · {relatedEntityId}
                    {' · '}
                    <button
                      type="button"
                      className="todo-editor-dialog__suggest-link inline"
                      disabled={busy}
                      onClick={() => {
                        touchedRef.current = true
                        setRelatedEntityType('')
                        setRelatedEntityId('')
                      }}
                    >
                      연결 해제
                    </button>
                  </div>
                ) : (
                  <p className="todo-editor-dialog__hint m-0">연결하지 않아도 저장할 수 있습니다.</p>
                )}
              </div>
            ) : null}
          </div>
          <footer className="flex-shrink-0 border-t border-[var(--border-default)] px-4 py-3 flex flex-wrap justify-between gap-2">
            <div>
              {mode === 'edit' ? (
                <FormButton htmlType="button" variant="danger" disabled={busy} onClick={() => void onDelete()}>
                  삭제
                </FormButton>
              ) : (
                <span />
              )}
            </div>
            <div className="flex gap-2">
              <FormButton variant="secondary" disabled={busy} onClick={() => void handleRequestClose()}>
                취소
              </FormButton>
              <FormButton variant="primary" disabled={busy} onClick={() => void submit()}>
                {busy ? '저장 중…' : '저장'}
              </FormButton>
            </div>
          </footer>
          <div className="text-xs text-[var(--text-muted)] px-4 pb-2">
            오늘(Asia/Seoul):{' '}
            <span>{formatSeoulYmd(new Date())}</span>
          </div>
        </div>
      </BaseDialog>
      {confirmDialog}
    </>
  )
}

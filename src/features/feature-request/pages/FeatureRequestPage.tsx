import { useCallback, useEffect, useState } from 'react'
import { FormDialog, useConfirmDialog } from '../../../components/dialog'
import { EmptyState, StatusMessage } from '../../../components/feedback'
import { FieldWrapper, FormButton, FormInput, FormTextarea } from '../../../components/form'
import {
  deleteMyFeatureRequest,
  listMyFeatureRequests,
  submitFeatureRequest,
  type FeatureRequestStatus,
  type MyFeatureRequestRow,
} from '../../auth/authApi'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../../components/ui'

function formatDate(iso: string): string {
  if (!iso) {
    return '—'
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return iso.slice(0, 10)
  }
  return d.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

function statusLabel(status: FeatureRequestStatus): string {
  if (status === 'done') {
    return '완료'
  }
  if (status === 'reviewed') {
    return '검토됨'
  }
  return '대기'
}

export default function FeatureRequestPage() {
  const { token } = useAuth()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<MyFeatureRequestRow[]>([])
  const [listError, setListError] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [modalError, setModalError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadRequests = useCallback(async () => {
    if (!token?.trim()) {
      return
    }
    setListError('')
    try {
      const list = await listMyFeatureRequests(token)
      setRows(list)
    } catch (e) {
      setListError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    }
  }, [token])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  useEffect(() => {
    if (!open) {
      setTitle('')
      setContent('')
      setModalError('')
    }
  }, [open])

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: '요청 삭제',
      message: '삭제하시겠습니까?',
      tone: 'danger',
    })
    if (!confirmed) {
      return
    }
    if (!token?.trim()) {
      return
    }
    setDeletingId(id)
    try {
      await deleteMyFeatureRequest(token, id)
      await loadRequests()
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSubmit = async () => {
    const t = title.trim()
    const c = content.trim()
    if (!t || !c) {
      return
    }
    if (!token?.trim()) {
      setModalError('로그인이 필요합니다.')
      return
    }
    setModalError('')
    setIsSubmitting(true)
    try {
      await submitFeatureRequest(token, { title: t, content: c })
      setOpen(false)
      setTitle('')
      setContent('')
      await loadRequests()
    } catch (err) {
      setModalError(err instanceof Error ? err.message : '등록에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openModal = () => {
    setModalError('')
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
  }

  return (
    <main className="page--with-back content-wrapper">
      <div className="flex justify-between items-center mb-3">
        <h1 className="text-lg font-semibold">추가기능 요청하기</h1>
        <Button type="button" className="shrink-0 px-3 py-1.5 text-xs" onClick={openModal}>
          작성하기
        </Button>
      </div>

      <StatusMessage message={listError} tone="error" className="mb-2" />

      <div className="rounded-xl border border-[var(--border-default)] overflow-hidden bg-[var(--bg-elevated)]">
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState message="등록된 요청이 없습니다." className="m-0 text-sm text-[var(--text-secondary)]" />
          </div>
        ) : (
          rows.map((item) => (
            <div
              key={item.id}
              className="p-3 border-b border-[var(--border-default)] last:border-b-0"
            >
              <div className="flex gap-2 mb-1">
                <span className="w-12 shrink-0 text-[var(--text-secondary)] text-sm">제목:</span>
                <span className="text-[var(--text-primary)] text-sm break-words">
                  {item.title || '(제목 없음)'}
                </span>
              </div>
              <div className="flex gap-2 mb-1">
                <span className="w-12 shrink-0 text-[var(--text-secondary)] text-sm">내용:</span>
                <span className="text-[var(--text-primary)] text-sm whitespace-pre-wrap break-words">
                  {item.content}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs mt-2 gap-2">
                <div className="flex flex-wrap gap-3 text-[var(--text-secondary)] min-w-0">
                  <span>상태: {statusLabel(item.status)}</span>
                  <span className="tabular-nums">작성일: {formatDate(item.created_at)}</span>
                </div>
                <FormButton
                  htmlType="button"
                  className="shrink-0 text-[var(--danger)] disabled:opacity-50"
                  disabled={deletingId === item.id}
                  onClick={() => void handleDelete(item.id)}
                >
                  {deletingId === item.id ? '삭제 중…' : '삭제'}
                </FormButton>
              </div>
            </div>
          ))
        )}
      </div>

      <FormDialog
        open={open}
        onClose={closeModal}
        title="추가기능 요청 작성"
        panelClassName="max-w-xl"
        footer={
          <div className="flex gap-2 flex-wrap">
            <FormButton htmlType="button" variant="primary" loading={isSubmitting} loadingText="등록 중…" onClick={() => void handleSubmit()}>
              등록
            </FormButton>
            <FormButton htmlType="button" variant="secondary" disabled={isSubmitting} onClick={closeModal}>
              취소
            </FormButton>
          </div>
        }
      >
        <div className="space-y-3">
          <FieldWrapper label="제목">
            <FormInput
              className="w-full text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              autoComplete="off"
            />
          </FieldWrapper>
          <FieldWrapper label="내용">
            <FormTextarea
              className="w-full text-sm"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={8000}
            />
          </FieldWrapper>
          <StatusMessage message={modalError} tone="error" />
        </div>
      </FormDialog>
      {confirmDialog}
    </main>
  )
}

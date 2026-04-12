import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import { customerRecordToUpdatePayload, updateCustomer } from '../api/customersApi'
import type { CustomerNote, CustomerNotesBag, CustomerRecord } from '../domain/types'
import { customerNoteItems, normalizeCustomerNotesBag } from '../domain/types'
import { NOTE_MAX_LENGTH } from '../utils/insuranceInfo'

function makePendingMemoId(): string {
  return `pending:${Date.now()}:${Math.random().toString(16).slice(2)}`
}

type Props = {
  customer: CustomerRecord
  token: string | null
  onPersisted: (customerId: number, newMemo: CustomerNotesBag) => void | Promise<void>
  onStatusMessage: (msg: string) => void
}

export const CustomerInlineNotesSection = memo(function CustomerInlineNotesSection({
  customer,
  token,
  onPersisted,
  onStatusMessage,
}: Props) {
  const navigate = useNavigate()
  const [memoOpen, setMemoOpen] = useState(false)
  const [draft, setDraft] = useState('')
  /** 상담 목록(rows)과 같이 메모만 별도 state — 타이핑·낙관적 반영은 여기서만 처리 */
  const [memos, setMemos] = useState<CustomerNote[]>(() => customerNoteItems(customer))
  const [saving, setSaving] = useState(false)
  const savingLock = useRef(false)
  const mountLogIdRef = useRef(customer.id)
  mountLogIdRef.current = customer.id

  /** DEV: 인스턴스가 타이핑 등으로 재마운트되는지 콘솔에서 확인 */
  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }
    const id = mountLogIdRef.current
    console.log('[CustomerInlineNotesSection] mount', id)
    return () => {
      console.log('[CustomerInlineNotesSection] unmount', mountLogIdRef.current)
    }
  }, [])

  const serverNotesSignature = useMemo(() => {
    const bag = normalizeCustomerNotesBag(customer.notes)
    return `${customer.id}|${JSON.stringify(bag)}`
  }, [customer.id, customer.notes])

  useEffect(() => {
    setMemos(customerNoteItems(customer))
  }, [serverNotesSignature, customer])

  const insuranceHistory = normalizeCustomerNotesBag(customer.notes).insuranceHistory

  const sortedItems = useMemo(() => {
    return [...memos].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [memos])

  function closeMemoModal() {
    setDraft('')
    setMemoOpen(false)
  }

  function openMemoModal() {
    setDraft('')
    setMemoOpen(true)
  }

  async function commitNotesToServer(nextItems: CustomerNote[], rollback: () => void) {
    if (!token?.trim()) {
      rollback()
      return
    }
    if (!Number.isFinite(customer.id) || customer.id < 1) {
      onStatusMessage('고객 정보가 올바르지 않습니다.')
      rollback()
      return
    }
    onStatusMessage('')
    try {
      const notesBag: CustomerNotesBag = {
        items: nextItems,
        insuranceHistory: insuranceHistory.trim(),
      }
      const payload = customerRecordToUpdatePayload(customer, notesBag)
      if (import.meta.env.DEV) {
        console.log('[CustomerInlineNotesSection] update payload:', payload)
      }
      const returned = await updateCustomer(token, customer.id, payload)
      const bag = normalizeCustomerNotesBag(returned.notes)
      setMemos(customerNoteItems({ notes: returned.notes }))
      await Promise.resolve(onPersisted(returned.id, bag))
    } catch (e) {
      rollback()
      const msg = e instanceof Error ? e.message : '메모 저장에 실패했습니다.'
      onStatusMessage(msg)
      window.alert(`저장 실패\n${msg}`)
    } finally {
      savingLock.current = false
      setSaving(false)
    }
  }

  function handleMemoSave() {
    if (savingLock.current) {
      return
    }
    const trimmed = draft.trim()
    if (!trimmed) {
      return
    }
    if (trimmed.length > NOTE_MAX_LENGTH) {
      onStatusMessage(`메모는 ${NOTE_MAX_LENGTH}자 이하로 입력해주세요.`)
      return
    }
    const tempId = makePendingMemoId()
    const optimistic: CustomerNote = {
      id: tempId,
      content: trimmed,
      createdAt: new Date().toISOString(),
    }
    const nextForApi = [optimistic, ...memos]

    savingLock.current = true
    setSaving(true)
    setMemos(nextForApi)
    closeMemoModal()

    void commitNotesToServer(nextForApi, () => {
      setMemos((prev) => prev.filter((m) => m.id !== tempId))
    })
  }

  function removeNote(id: string) {
    if (savingLock.current) {
      return
    }
    const snapshot = memos
    const nextForApi = snapshot.filter((n) => n.id !== id)

    savingLock.current = true
    setSaving(true)
    setMemos(nextForApi)

    void commitNotesToServer(nextForApi, () => {
      setMemos(snapshot)
    })
  }

  return (
    <div className="customer-inline-notes mt-5">
      <div className="flex justify-between items-center mb-2 gap-2">
        <div className="customer-section-title !mt-0">[메모]</div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            className="!px-3 !py-1.5 text-xs shrink-0"
            disabled={!token?.trim()}
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/customers/${customer.id}/files`, { state: { customerName: customer.name } })
            }}
          >
            파일
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="!px-3 !py-1.5 text-xs shrink-0"
            disabled={saving || !token?.trim()}
            onClick={openMemoModal}
          >
            메모 추가
          </Button>
        </div>
      </div>
      {sortedItems.length === 0 ? (
        <div className="text-sm text-[var(--text-secondary)] mt-2">등록된 내용이 없습니다.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
          {sortedItems.map((note) => (
            <li
              key={note.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                alignItems: 'flex-start',
                borderTop: '1px solid rgba(0,0,0,0.08)',
                padding: '8px 0',
                fontSize: '0.9rem',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{note.content}</div>
                <small style={{ opacity: 0.75 }}>{new Date(note.createdAt).toLocaleString('ko-KR')}</small>
              </div>
              <button
                type="button"
                aria-label="메모 삭제"
                title="삭제"
                disabled={saving}
                style={{
                  flexShrink: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: saving ? 'default' : 'pointer',
                  fontSize: '1.1rem',
                  lineHeight: 1,
                  padding: '2px 6px',
                  opacity: 0.75,
                }}
                onClick={() => removeNote(note.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={memoOpen} onClose={closeMemoModal} ariaLabel="메모 입력">
        <div className="text-lg font-semibold mb-2 text-[var(--text-primary)]">메모 입력</div>
        <textarea
          className="w-full border border-[var(--border-default)] rounded-lg p-2 mb-3 bg-[var(--bg-card)] text-[var(--text-primary)] box-border min-h-[120px]"
          value={draft}
          maxLength={NOTE_MAX_LENGTH}
          onChange={(e) => setDraft(e.target.value.slice(0, NOTE_MAX_LENGTH))}
          placeholder="메모 내용"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
        />
        <div className="flex gap-2 justify-end flex-wrap">
          <Button type="button" variant="secondary" onClick={closeMemoModal}>
            취소
          </Button>
          <Button type="button" disabled={saving || !draft.trim()} onClick={handleMemoSave}>
            확인
          </Button>
        </div>
      </Modal>
    </div>
  )
})

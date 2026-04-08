import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import { customerRecordToUpdatePayload, updateCustomer } from '../api/customersApi'
import type { CustomerNote, CustomerNotesBag, CustomerRecord } from '../domain/types'
import { customerNoteItems, normalizeCustomerNotesBag } from '../domain/types'
import { NOTE_MAX_LENGTH } from '../utils/insuranceInfo'

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
  const [memoOpen, setMemoOpen] = useState(false)
  /** 모달 입력창: 타이핑은 로컬만 갱신 (부모 state/API 호출 없음) */
  const [localNotes, setLocalNotes] = useState('')
  /** 카드에 표시되는 메모 목록; 저장·삭제 API 성공 후 부모가 내려준 notes와 동기화 */
  const [localNoteItems, setLocalNoteItems] = useState<CustomerNote[]>(() => customerNoteItems(customer))
  const [saving, setSaving] = useState(false)
  const savingLock = useRef(false)

  const serverNotesSignature = useMemo(() => {
    const bag = normalizeCustomerNotesBag(customer.notes)
    return `${customer.id}|${JSON.stringify(bag)}`
  }, [customer.id, customer.notes])

  useEffect(() => {
    setLocalNoteItems(customerNoteItems(customer))
  }, [serverNotesSignature, customer])

  const insuranceHistory = normalizeCustomerNotesBag(customer.notes).insuranceHistory

  const sortedItems = useMemo(() => {
    return [...localNoteItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [localNoteItems])

  function closeMemoModal() {
    setLocalNotes('')
    setMemoOpen(false)
  }

  async function persistNotes(nextItems: CustomerNote[]) {
    if (!token?.trim()) {
      return
    }
    if (!Number.isFinite(customer.id) || customer.id < 1) {
      onStatusMessage('고객 정보가 올바르지 않습니다.')
      return
    }
    if (savingLock.current) {
      return
    }
    savingLock.current = true
    setSaving(true)
    onStatusMessage('')
    try {
      const notesBag = {
        items: nextItems,
        insuranceHistory: insuranceHistory.trim(),
      }
      const payload = customerRecordToUpdatePayload(customer, notesBag)
      if (import.meta.env.DEV) {
        console.log('[CustomerInlineNotesSection] update payload:', payload)
      }
      await updateCustomer(token, customer.id, payload)
      await Promise.resolve(onPersisted(customer.id, notesBag))
    } catch (e) {
      const msg = e instanceof Error ? e.message : '메모 저장에 실패했습니다.'
      onStatusMessage(msg)
      window.alert(`저장 실패\n${msg}`)
    } finally {
      savingLock.current = false
      setSaving(false)
    }
  }

  function openMemoModal() {
    setLocalNotes('')
    setMemoOpen(true)
  }

  function handleMemoSave() {
    if (savingLock.current) {
      return
    }
    const trimmed = localNotes.trim()
    if (!trimmed) {
      return
    }
    if (trimmed.length > NOTE_MAX_LENGTH) {
      onStatusMessage(`메모는 ${NOTE_MAX_LENGTH}자 이하로 입력해주세요.`)
      return
    }
    const newNote: CustomerNote = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      content: trimmed,
      createdAt: new Date().toISOString(),
    }
    const nextItems = [newNote, ...localNoteItems]
    closeMemoModal()
    void persistNotes(nextItems)
  }

  function removeNote(id: string) {
    if (savingLock.current) {
      return
    }
    const nextItems = localNoteItems.filter((n) => n.id !== id)
    void persistNotes(nextItems)
  }

  return (
    <div className="customer-inline-notes mt-5">
      <div className="flex justify-between items-center mb-2 gap-2">
        <div className="customer-section-title !mt-0">[메모]</div>
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
          value={localNotes}
          maxLength={NOTE_MAX_LENGTH}
          onChange={(e) => setLocalNotes(e.target.value.slice(0, NOTE_MAX_LENGTH))}
          placeholder="메모 내용"
        />
        <div className="flex gap-2 justify-end flex-wrap">
          <Button type="button" variant="secondary" onClick={closeMemoModal}>
            취소
          </Button>
          <Button type="button" disabled={saving || !localNotes.trim()} onClick={handleMemoSave}>
            확인
          </Button>
        </div>
      </Modal>
    </div>
  )
})

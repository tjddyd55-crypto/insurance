import { useRef, useState } from 'react'
import { customerRecordToUpdatePayload, updateCustomer } from '../api/customersApi'
import type { CustomerNote, CustomerRecord } from '../domain/types'
import { customerNoteItems, normalizeCustomerNotesBag } from '../domain/types'
import { NOTE_MAX_LENGTH } from '../utils/insuranceInfo'

type Props = {
  customer: CustomerRecord
  token: string | null
  /** 메모 저장 API 성공 후 목록을 서버 기준으로 다시 불러올 때 호출 */
  onPersisted: () => void | Promise<void>
  onStatusMessage: (msg: string) => void
}

export function CustomerInlineNotesSection({ customer, token, onPersisted, onStatusMessage }: Props) {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const savingLock = useRef(false)

  const items = customerNoteItems(customer)
  const insuranceHistory = normalizeCustomerNotesBag(customer.notes).insuranceHistory

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
      await Promise.resolve(onPersisted())
    } catch (e) {
      const msg = e instanceof Error ? e.message : '메모 저장에 실패했습니다.'
      onStatusMessage(msg)
      window.alert(`저장 실패\n${msg}`)
    } finally {
      savingLock.current = false
      setSaving(false)
    }
  }

  function addNote() {
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
    const newNote: CustomerNote = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      content: trimmed,
      createdAt: new Date().toISOString(),
    }
    setDraft('')
    void persistNotes([newNote, ...items])
  }

  function removeNote(id: string) {
    if (savingLock.current) {
      return
    }
    void persistNotes(items.filter((n) => n.id !== id))
  }

  return (
    <div className="customer-inline-notes" style={{ marginTop: 12 }}>
      <h3 className="customer-form-history__title" style={{ fontSize: '1rem', marginBottom: 8 }}>
        메모
      </h3>
      <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 8, alignItems: 'center', overflow: 'hidden' }}>
        <input
          className="field__control"
          style={{ flex: '1 1 160px', minWidth: 0, fontSize: '0.875rem' }}
          placeholder="메모 입력"
          value={draft}
          maxLength={NOTE_MAX_LENGTH}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value.slice(0, NOTE_MAX_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addNote()
            }
          }}
        />
        <button
          type="button"
          className="filter-button"
          style={{ fontSize: '0.875rem', padding: '4px 10px', flexShrink: 0 }}
          disabled={saving}
          onClick={() => addNote()}
        >
          {saving ? '저장 중...' : '추가'}
        </button>
      </div>
      {items.length === 0 ? (
        <p style={{ fontSize: '0.88rem', color: '#666', margin: '8px 0 0' }}>등록된 메모가 없습니다.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
          {items.map((note) => (
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
    </div>
  )
}

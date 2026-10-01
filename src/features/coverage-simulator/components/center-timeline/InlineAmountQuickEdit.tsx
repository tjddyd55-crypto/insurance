import { useRef, useState, type PointerEvent } from 'react'

import {
  formatCoverageAmountLabel,
  formatManWonInputDisplay,
  parseManWonInput,
  sanitizeManWonInputTyping,
} from '../../domain/formatAmount'

export type InlineAmountField = 'current' | 'proposed'

type Props = {
  amount: number | null
  field: InlineAmountField
  active: boolean
  className: string
  onActivate: () => void
  onCommit: (amount: number | null) => void
  onEndEdit: () => void
}

export function InlineAmountQuickEdit({
  amount,
  field,
  active,
  className,
  onActivate,
  onCommit,
  onEndEdit,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const draftRef = useRef('')
  const skipCommitRef = useRef(false)

  const setDraftValue = (next: string) => {
    draftRef.current = next
    setDraft(next)
  }

  const commitDraft = () => {
    const trimmed = draftRef.current.trim()
    onCommit(trimmed ? parseManWonInput(trimmed) : null)
  }

  const beginEdit = (event: PointerEvent<HTMLInputElement>) => {
    if (active) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const next = formatManWonInputDisplay(amount)
    setDraftValue(next)
    const input = event.currentTarget
    input.readOnly = false
    input.value = next
    input.focus()
    input.select()
    onActivate()
  }

  return (
    <div
      className={`${className}${active ? ' cs-axis-amount--inline-editing' : ''}`}
      data-inline-amount-field={field}
    >
      {/* 금액 글자 그대로 포커스해야 첫 탭에 키보드가 열린다. FormInput 크롬을 쓰면 행 높이가 깨진다. */}
      {/* eslint-disable-next-line no-restricted-syntax */}
      <input
        ref={inputRef}
        className="cs-axis-amount__inline-input"
        inputMode={active ? 'numeric' : 'none'}
        enterKeyHint="done"
        autoComplete="off"
        readOnly={!active}
        aria-label={field === 'current' ? '기존 보장 금액' : '제안 보장 금액'}
        value={active ? draft : formatCoverageAmountLabel(amount)}
        onPointerDown={beginEdit}
        onChange={(event) => setDraftValue(sanitizeManWonInputTyping(event.target.value))}
        onBlur={() => {
          if (!active) return
          if (skipCommitRef.current) {
            skipCommitRef.current = false
            onEndEdit()
            return
          }
          commitDraft()
          onEndEdit()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            skipCommitRef.current = true
            event.currentTarget.blur()
          }
        }}
      />
      {active ? <span className="cs-axis-amount__unit"> 만원</span> : null}
    </div>
  )
}

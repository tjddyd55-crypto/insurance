import { useEffect, useRef, useState } from 'react'

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
  onCancel: () => void
}

export function InlineAmountQuickEdit({
  amount,
  field,
  active,
  className,
  onActivate,
  onCommit,
  onCancel,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!active) return
    setDraft(formatManWonInputDisplay(amount))
    const frame = window.requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) return
      input.focus()
      input.select()
      input.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [active, amount])

  const commit = () => {
    const trimmed = draft.trim()
    const next = trimmed ? parseManWonInput(trimmed) : null
    onCommit(next)
  }

  if (!active) {
    return (
      <button type="button" className={className} onClick={onActivate}>
        <span className="cs-axis-amount__value">{formatCoverageAmountLabel(amount)}</span>
      </button>
    )
  }

  return (
    <div
      className={`${className} cs-axis-amount--inline-editing`}
      data-inline-amount-field={field}
    >
      <input
        ref={inputRef}
        className="cs-axis-amount__inline-input"
        inputMode="numeric"
        enterKeyHint="done"
        autoComplete="off"
        aria-label={field === 'current' ? '기존 보장 금액' : '제안 보장 금액'}
        value={draft}
        onChange={(event) => setDraft(sanitizeManWonInputTyping(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          }
        }}
      />
      <span className="cs-axis-amount__unit">만원</span>
      <button type="button" className="cs-axis-amount__inline-confirm" aria-label="확인" onClick={commit}>
        ✓
      </button>
      <button type="button" className="cs-axis-amount__inline-cancel" aria-label="취소" onClick={onCancel}>
        ×
      </button>
    </div>
  )
}

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
  const draftRef = useRef(draft)
  draftRef.current = draft
  const skipCommitOnDeactivateRef = useRef(false)

  const commitDraft = () => {
    const trimmed = draftRef.current.trim()
    const next = trimmed ? parseManWonInput(trimmed) : null
    onCommit(next)
  }

  useEffect(() => {
    if (!active) return undefined
    skipCommitOnDeactivateRef.current = false
    setDraft(formatManWonInputDisplay(amount))
    const frame = window.requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) return
      input.focus()
      input.select()
      input.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
    return () => {
      window.cancelAnimationFrame(frame)
      if (skipCommitOnDeactivateRef.current) return
      commitDraft()
    }
  }, [active, amount])

  if (!active) {
    return (
      <button type="button" className={className} onClick={onActivate}>
        <span className="cs-axis-amount__value">{formatCoverageAmountLabel(amount)}</span>
      </button>
    )
  }

  return (
    <div className={`${className} cs-axis-amount--inline-editing`} data-inline-amount-field={field}>
      <input
        ref={inputRef}
        className="cs-axis-amount__inline-input"
        inputMode="numeric"
        enterKeyHint="done"
        autoComplete="off"
        aria-label={field === 'current' ? '기존 보장 금액' : '제안 보장 금액'}
        value={draft}
        onChange={(event) => setDraft(sanitizeManWonInputTyping(event.target.value))}
        onBlur={() => {
          commitDraft()
          onEndEdit()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void inputRef.current?.blur()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            skipCommitOnDeactivateRef.current = true
            onEndEdit()
          }
        }}
      />
      <span className="cs-axis-amount__unit"> 만원</span>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

type Props = {
  label: string
  active: boolean
  className: string
  onActivate: () => void
  onCommit: (label: string) => void
  onEndEdit: () => void
  onRegisterCommit?: (commit: (() => void) | null) => void
}

export function InlineTitleQuickEdit({
  label,
  active,
  className,
  onActivate,
  onCommit,
  onEndEdit,
  onRegisterCommit,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const draftRef = useRef(draft)
  draftRef.current = draft
  const skipCommitOnDeactivateRef = useRef(false)
  const committedRef = useRef(false)
  const originalLabelRef = useRef(label)

  const commitDraft = () => {
    onCommit(draftRef.current)
  }

  const commitAndClose = () => {
    if (committedRef.current) return
    committedRef.current = true
    commitDraft()
    onEndEdit()
  }

  useEffect(() => {
    if (!active) {
      onRegisterCommit?.(null)
      return undefined
    }
    skipCommitOnDeactivateRef.current = false
    committedRef.current = false
    originalLabelRef.current = label
    setDraft(label)
    onRegisterCommit?.(() => {
      commitAndClose()
    })
    const frame = window.requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) return
      input.focus()
      input.select()
      input.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
    return () => {
      window.cancelAnimationFrame(frame)
      onRegisterCommit?.(null)
      if (skipCommitOnDeactivateRef.current || committedRef.current) return
      commitDraft()
    }
  }, [active, label, onRegisterCommit])

  if (!active) {
    return (
      <button type="button" className={className} onClick={onActivate}>
        <span className="cs-axis-event__label">{label}</span>
      </button>
    )
  }

  return (
    <div className={`${className} cs-axis-title--inline-editing`}>
      <input
        ref={inputRef}
        className="cs-axis-title__inline-input"
        enterKeyHint="done"
        autoComplete="off"
        aria-label="항목명"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          commitAndClose()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void inputRef.current?.blur()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            skipCommitOnDeactivateRef.current = true
            setDraft(originalLabelRef.current)
            onEndEdit()
          }
        }}
      />
    </div>
  )
}

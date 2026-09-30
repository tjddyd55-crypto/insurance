import { useRef, useState, type PointerEvent } from 'react'

type Props = {
  label: string
  active: boolean
  onActivate: () => void
  onCommit: (label: string) => void
  onEndEdit: () => void
}

export function InlineTitleQuickEdit({ label, active, onActivate, onCommit, onEndEdit }: Props) {
  const [draft, setDraft] = useState(label)
  const draftRef = useRef(label)
  const skipCommitRef = useRef(false)

  const setDraftValue = (next: string) => {
    draftRef.current = next
    setDraft(next)
  }

  const beginEdit = (event: PointerEvent<HTMLInputElement>) => {
    if (active) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    setDraftValue(label)
    const input = event.currentTarget
    input.readOnly = false
    input.value = label
    input.focus()
    input.select()
    onActivate()
  }

  return (
    <>
      <span className="cs-axis-event__label" aria-hidden={active}>
        {label}
      </span>
      {/* 항목명 글자 위에서 바로 focus() 해야 모바일 첫 탭에 키보드가 열린다. */}
      {/* eslint-disable-next-line no-restricted-syntax */}
      <input
        className={active ? 'cs-axis-event__title-input is-active' : 'cs-axis-event__title-input'}
        aria-label="항목명"
        readOnly={!active}
        value={active ? draft : label}
        onPointerDown={beginEdit}
        onChange={(event) => setDraftValue(event.target.value)}
        onBlur={() => {
          if (!active) return
          if (skipCommitRef.current) {
            skipCommitRef.current = false
            onEndEdit()
            return
          }
          const next = draftRef.current.trim()
          onCommit(next || label)
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
    </>
  )
}

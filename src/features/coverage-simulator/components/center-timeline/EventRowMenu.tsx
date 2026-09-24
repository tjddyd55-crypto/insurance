import { useEffect, useRef, useState } from 'react'

type EventRowMenuProps = {
  onEditAmount: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}

export function EventRowMenu({ onEditAmount, onMoveUp, onMoveDown, onDelete }: EventRowMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="cs-axis-row-menu" ref={rootRef}>
      <button
        type="button"
        className="cs-axis-row-menu__trigger"
        aria-label="항목 메뉴"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        ⋯
      </button>
      {open ? (
        <div className="cs-axis-row-menu__panel" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onEditAmount() }}>
            금액·항목 수정
          </button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onMoveUp() }}>
            위로 이동
          </button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onMoveDown() }}>
            아래로 이동
          </button>
          <button type="button" role="menuitem" className="cs-axis-row-menu__danger" onClick={() => { setOpen(false); onDelete() }}>
            삭제
          </button>
        </div>
      ) : null}
    </div>
  )
}

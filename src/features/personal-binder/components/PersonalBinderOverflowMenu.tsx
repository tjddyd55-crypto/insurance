import { useEffect, useId, useRef, useState } from 'react'

export type PersonalBinderOverflowMenuItem = {
  id: string
  label: string
  disabled?: boolean
  tone?: 'default' | 'danger'
  onSelect: () => void
}

type Props = {
  ariaLabel: string
  items: PersonalBinderOverflowMenuItem[]
  disabled?: boolean
  className?: string
}

export function PersonalBinderOverflowMenu({
  ariaLabel,
  items,
  disabled = false,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div className={['personal-binder-overflow-menu', className].filter(Boolean).join(' ')} ref={rootRef}>
      <button
        type="button"
        className="personal-binder-overflow-menu__trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
      >
        ⋯
      </button>
      {open ? (
        <div className="personal-binder-overflow-menu__panel" id={menuId} role="menu">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={[
                'personal-binder-overflow-menu__item',
                item.tone === 'danger' ? 'personal-binder-overflow-menu__item--danger' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={(event) => {
                event.stopPropagation()
                setOpen(false)
                if (!item.disabled) item.onSelect()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

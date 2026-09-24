import { useState } from 'react'

import { ItemActionSheet } from '../ItemActionSheet'

type Props = {
  menuMode: 'inline-delete' | 'action-sheet'
  onDelete: () => void
}

export function TimeMarkerRowMenu({ menuMode, onDelete }: Props) {
  const [open, setOpen] = useState(false)

  if (menuMode === 'inline-delete') {
    return (
      <button
        type="button"
        className="cs-axis-marker__delete coverage-simulator-time-marker__delete"
        onClick={onDelete}
      >
        삭제
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        className="cs-axis-row-menu__trigger cs-axis-marker__menu-trigger"
        aria-label="시간 구간 메뉴"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        ⋯
      </button>
      <ItemActionSheet
        open={open}
        title="시간 구간"
        onClose={() => setOpen(false)}
        actions={[
          {
            id: 'delete',
            label: '시간 구간 삭제',
            destructive: true,
            onSelect: onDelete,
          },
        ]}
      />
    </>
  )
}

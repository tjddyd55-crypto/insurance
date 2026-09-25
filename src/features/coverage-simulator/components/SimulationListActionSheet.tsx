import { createPortal } from 'react-dom'

import { useCoverageSimulatorOverlayScrollLock } from '../hooks/useCoverageSimulatorOverlayScrollLock'

type Props = {
  open: boolean
  documentTitle: string
  onClose: () => void
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}

export function SimulationListActionSheet({
  open,
  documentTitle,
  onClose,
  onOpen,
  onRename,
  onDelete,
}: Props) {
  useCoverageSimulatorOverlayScrollLock(open)

  if (!open) return null

  const runAction = (action: () => void) => {
    onClose()
    action()
  }

  const sheet = (
    <div className="cs-sim-list-action-overlay" role="presentation" onClick={onClose}>
      <div
        className="cs-sim-list-action-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cs-sim-list-action-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cs-sim-list-action-header">
          <h2 id="cs-sim-list-action-title" className="cs-sim-list-action-header__title">
            시뮬레이션
          </h2>
        </header>
        <p className="cs-sim-list-action-subject">{documentTitle}</p>
        <div className="cs-sim-list-action-list" role="menu">
          <button type="button" role="menuitem" className="cs-sim-list-action-row" onClick={() => runAction(onOpen)}>
            열기
          </button>
          <button type="button" role="menuitem" className="cs-sim-list-action-row" onClick={() => runAction(onRename)}>
            제목 수정
          </button>
          <button
            type="button"
            role="menuitem"
            className="cs-sim-list-action-row cs-sim-list-action-row--danger"
            onClick={() => runAction(onDelete)}
          >
            삭제
          </button>
        </div>
        <footer className="cs-sim-list-action-footer">
          <button type="button" className="cs-sim-list-action-cancel" onClick={onClose}>
            취소
          </button>
        </footer>
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}

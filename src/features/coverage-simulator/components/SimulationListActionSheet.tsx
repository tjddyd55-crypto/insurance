import { CoverageSimulatorOverlayShell } from './CoverageSimulatorOverlayShell'

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
  const runAction = (action: () => void) => {
    onClose()
    action()
  }

  return (
    <CoverageSimulatorOverlayShell
      open={open}
      layer="action"
      panelClassName="cs-list-action-sheet"
      ariaLabelledBy="cs-list-action-title"
      onClose={onClose}
    >
      <header>
        <h2 id="cs-list-action-title" className="cs-list-action-sheet__title">
          시뮬레이션
        </h2>
      </header>
      <p className="cs-list-action-sheet__subject">{documentTitle}</p>
      <div className="cs-list-action-sheet__list" role="menu">
        <button type="button" role="menuitem" className="cs-list-action-sheet__row" onClick={() => runAction(onOpen)}>
          열기
        </button>
        <button type="button" role="menuitem" className="cs-list-action-sheet__row" onClick={() => runAction(onRename)}>
          제목 수정
        </button>
        <button
          type="button"
          role="menuitem"
          className="cs-list-action-sheet__row cs-list-action-sheet__row--danger"
          onClick={() => runAction(onDelete)}
        >
          삭제
        </button>
      </div>
      <footer className="cs-list-action-sheet__footer">
        <button type="button" className="cs-list-action-sheet__cancel" onClick={onClose}>
          취소
        </button>
      </footer>
    </CoverageSimulatorOverlayShell>
  )
}

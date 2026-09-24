import { mobilePreviewHeaderTitle } from '../domain/mobilePreviewHeaderTitle'

type Props = {
  title: string
  onBack: () => void
  onReset: () => void
  onSave: () => void
  onPdf?: () => void
  resetLabel?: string
  showPdf?: boolean
}

export function MobilePreviewEditorHeader({
  title,
  onBack,
  onReset,
  onSave,
  onPdf,
  resetLabel = '초기화',
  showPdf = true,
}: Props) {
  const displayTitle = mobilePreviewHeaderTitle(title)

  return (
    <header className="cs-mobile-editor-header">
      <button type="button" className="cs-mobile-editor-header__back" onClick={onBack} aria-label="뒤로">
        ←
      </button>
      <h1 className="cs-mobile-editor-header__title" title={title}>{displayTitle}</h1>
      <div className="cs-mobile-editor-header__actions">
        <button type="button" className="cs-mobile-editor-header__action" onClick={onReset}>
          {resetLabel}
        </button>
        <button type="button" className="cs-mobile-editor-header__action cs-mobile-editor-header__action--save" onClick={onSave}>
          저장
        </button>
        {showPdf && onPdf ? (
          <button type="button" className="cs-mobile-editor-header__action cs-mobile-editor-header__action--muted" onClick={onPdf}>
            PDF
          </button>
        ) : null}
      </div>
    </header>
  )
}

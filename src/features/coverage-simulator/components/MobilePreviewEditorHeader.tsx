import type { ReactNode } from 'react'

import { mobilePreviewHeaderTitle } from '../domain/mobilePreviewHeaderTitle'

type Props = {
  title: string
  headerLeadingActions?: ReactNode
  onBack: () => void
  showBack?: boolean
  onReset: () => void
  onSave: () => void
  saving?: boolean
  onPdf?: () => void
  onShare?: () => void
  onShareHistory?: () => void
  shareDisabled?: boolean
  resetLabel?: string
  showPdf?: boolean
  showShare?: boolean
}

export function MobilePreviewEditorHeader({
  title,
  headerLeadingActions,
  onBack,
  showBack = true,
  onReset,
  onSave,
  saving = false,
  onPdf,
  onShare,
  onShareHistory,
  shareDisabled = false,
  resetLabel = '초기화',
  showPdf = true,
  showShare = false,
}: Props) {
  const displayTitle = mobilePreviewHeaderTitle(title)

  return (
    <header className="cs-mobile-editor-header">
      {showBack ? (
        <button type="button" className="cs-mobile-editor-header__back" onClick={onBack} aria-label="뒤로">
          ←
        </button>
      ) : (
        <span className="cs-mobile-editor-header__back cs-mobile-editor-header__back--placeholder" aria-hidden="true" />
      )}
      <h1 className="cs-mobile-editor-header__title" title={title}>{displayTitle}</h1>
      <div className="cs-mobile-editor-header__actions">
        {headerLeadingActions}
        <button type="button" className="cs-mobile-editor-header__action" onClick={onReset}>
          {resetLabel}
        </button>
        <button
          type="button"
          className="cs-mobile-editor-header__action cs-mobile-editor-header__action--save"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        {showShare && onShare ? (
          <button
            type="button"
            className="cs-mobile-editor-header__action cs-mobile-editor-header__action--muted"
            onClick={onShare}
            disabled={shareDisabled}
          >
            공유
          </button>
        ) : null}
        {showShare && onShareHistory ? (
          <button
            type="button"
            className="cs-mobile-editor-header__action cs-mobile-editor-header__action--muted"
            onClick={onShareHistory}
            aria-label="공유 이력"
          >
            이력
          </button>
        ) : null}
        {showPdf && onPdf ? (
          <button type="button" className="cs-mobile-editor-header__action cs-mobile-editor-header__action--muted" onClick={onPdf}>
            PDF
          </button>
        ) : null}
      </div>
    </header>
  )
}

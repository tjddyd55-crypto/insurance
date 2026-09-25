import type { ReactNode } from 'react'

import FormButton from '../../../components/form/FormButton'

type Props = {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

/**
 * Mobile Add/Edit — in-root full-screen form surface (no portal, no overlay scroll lock).
 */
export function CoverageSimulatorFormScreen({ title, onClose, children, footer }: Props) {
  return (
    <div
      className="cs-form-screen"
      data-testid="coverage-simulator-form-screen"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="cs-form-screen__header">
        <FormButton
          variant="action"
          className="cs-form-screen__back"
          onClick={onClose}
          aria-label="닫기"
        >
          ←
        </FormButton>
        <h1 className="cs-form-screen__title">{title}</h1>
        <span className="cs-form-screen__header-spacer" aria-hidden="true" />
      </header>
      <main className="cs-form-screen__body">{children}</main>
      {footer ? <footer className="cs-form-screen__footer">{footer}</footer> : null}
    </div>
  )
}

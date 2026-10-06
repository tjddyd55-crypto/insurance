import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** pane/list 위 optional chrome (고객 선택 등) — Editor JSX 밖 */
  beforeEditor?: ReactNode
}

/** 3-pane·고객 상세 content pane — overflow/min-width만 담당 */
export function CoverageEditorPanelShell({ children, beforeEditor }: Props) {
  return (
    <div className="coverage-editor-panel-shell">
      {beforeEditor}
      <div className="coverage-editor-panel-shell__editor">{children}</div>
    </div>
  )
}

import type { ReactNode, RefObject } from 'react'

import { CustomerWorkspaceTabs, type CustomerWorkspaceTabItem } from './CustomerWorkspaceTabs'
import './CustomerWorkspacePageShell.css'

type Props = {
  tabs: CustomerWorkspaceTabItem[]
  activeTabId: string | null
  bodyRef?: RefObject<HTMLDivElement | null>
  children: ReactNode
}

export function CustomerWorkspacePageShell({ tabs, activeTabId, bodyRef, children }: Props) {
  return (
    <div className="customer-workspace-page">
      <CustomerWorkspaceTabs tabs={tabs} activeTabId={activeTabId} />
      <div
        ref={bodyRef}
        id="customer-workspace-page-panel"
        className="customer-workspace-page__body customer-workspace-layout__right-body"
        role="tabpanel"
        aria-labelledby={
          activeTabId ? `customer-workspace-tab-${activeTabId}` : undefined
        }
      >
        {children}
      </div>
    </div>
  )
}

import type { ReactNode } from 'react'
import { SharedAccountListLinkActions } from '../../components/SharedAccountListLinkActions'
import type { SharedAccountVaultListViewProps } from '../../hooks/useSharedAccountVaultListState'
import { SharedAccountVaultPublicDetailPanel } from './SharedAccountVaultPublicDetailPanel'
import { SharedAccountVaultStaffDetailPanel } from './SharedAccountVaultStaffDetailPanel'
import { SharedAccountVaultUserSidebar } from './SharedAccountVaultUserSidebar'
import { SharedAccountVaultWorkspaceEmpty } from './SharedAccountVaultWorkspaceEmpty'

export type SharedAccountVaultWorkspaceMode = 'staff' | 'public'

export type SharedAccountVaultWorkspaceViewProps = SharedAccountVaultListViewProps & {
  selectedUserId: string | null
  detailInitialName: string
  workspaceMode: SharedAccountVaultWorkspaceMode
  authToken?: string
  publicListToken?: string
  detailLayout: 'dual-column' | 'stacked'
}

export type SharedAccountVaultWorkspaceShellProps = Omit<
  SharedAccountVaultWorkspaceViewProps,
  'detailLayout'
>

function renderDetailPanel(props: SharedAccountVaultWorkspaceViewProps): ReactNode | null {
  const { selectedUserId, detailInitialName, workspaceMode, authToken, publicListToken, detailLayout } = props
  if (!selectedUserId) {
    return null
  }
  if (workspaceMode === 'staff') {
    return (
      <SharedAccountVaultStaffDetailPanel
        key={selectedUserId}
        authToken={authToken ?? ''}
        userId={selectedUserId}
        initialName={detailInitialName}
        layout={detailLayout}
      />
    )
  }
  return (
    <SharedAccountVaultPublicDetailPanel
      key={selectedUserId}
      listToken={publicListToken ?? ''}
      userId={selectedUserId}
      initialName={detailInitialName}
      layout={detailLayout}
    />
  )
}

export function SharedAccountVaultWorkspaceBody(props: SharedAccountVaultWorkspaceViewProps) {
  const {
    users,
    totalUserCount,
    loading,
    error,
    search,
    onSearchChange,
    onOpenUser,
    listLink,
    selectedUserId,
  } = props
  const detailPanel = renderDetailPanel(props)

  return (
    <>
      <header className="user-insurer-accounts-page__header user-insurer-accounts-page__header--toolbar">
        <div className="user-insurer-accounts-page__header-main">
          <h1>공유 계정관리</h1>
        </div>
        {listLink ? (
          <div className="user-insurer-accounts-page__share-controls shared-account-list__link-controls">
            <SharedAccountListLinkActions {...listLink} headingLabel="공유 계정관리 목록 URL" />
          </div>
        ) : null}
      </header>

      <div className="shared-account-workspace">
        <SharedAccountVaultUserSidebar
          users={users}
          totalUserCount={totalUserCount}
          loading={loading}
          error={error}
          search={search}
          selectedUserId={selectedUserId}
          onSearchChange={onSearchChange}
          onOpenUser={onOpenUser}
        />

        <section className="shared-account-workspace__detail" aria-live="polite">
          {detailPanel ?? <SharedAccountVaultWorkspaceEmpty />}
        </section>
      </div>
    </>
  )
}

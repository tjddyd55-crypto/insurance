import { useEffect, useState } from 'react'
import { FormButton, FormInput } from '../../../components/form'
import { BaseDialog } from '../../../components/dialog/BaseDialog'
import {
  USER_INSURER_ACCOUNT_ADD_LABEL,
  USER_INSURER_ACCOUNT_EMPTY_LABEL,
  USER_INSURER_ACCOUNT_TABS,
  type UserInsurerAccountCategory,
} from '../config/userInsurerAccounts.config'
import type { UserInsurerAccountsViewProps } from '../hooks/useUserInsurerAccountsState'
import type { UserInsurerAccountRow } from '../api/userInsurerAccountsApi'
import { formatAccountSavedAt } from './userInsurerAccountSavedAt'
import { UserInsurerAccountCopyButton } from './UserInsurerAccountCopyButton'

type LocalDraft = {
  loginId: string
  loginPassword: string
}

type AccountSectionProps = {
  title: string
  category: UserInsurerAccountCategory
  rows: UserInsurerAccountRow[]
  pendingId: string | null
  onAdd: () => void
  onSave: (row: UserInsurerAccountRow, patch: Partial<UserInsurerAccountRow>) => void
  onDelete: (row: UserInsurerAccountRow) => void
}

const SECTION_MODIFIER: Record<UserInsurerAccountCategory, string> = {
  LIFE: 'life',
  NON_LIFE: 'non-life',
  GENERAL: 'general',
}

function AccountRowEditor({
  row,
  pending,
  onSave,
  onDelete,
}: {
  row: UserInsurerAccountRow
  pending: boolean
  onSave: (patch: Partial<UserInsurerAccountRow>) => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState<LocalDraft>({
    loginId: row.loginId,
    loginPassword: row.loginPassword,
  })

  useEffect(() => {
    setDraft({
      loginId: row.loginId,
      loginPassword: row.loginPassword,
    })
  }, [row.id, row.loginId, row.loginPassword, row.updatedAt])

  const handleSave = () => {
    onSave({
      loginId: draft.loginId,
      loginPassword: draft.loginPassword,
    })
  }

  return (
    <div className="insurer-account-table__row" role="row">
      <div className="insurer-account-table__company" role="cell">
        {row.companyName}
      </div>
      <div className="insurer-account-table__field" role="cell">
        <FormInput
          value={draft.loginId}
          onChange={(event) => setDraft((prev) => ({ ...prev, loginId: event.target.value }))}
          placeholder="아이디"
          disabled={pending}
        />
      </div>
      <div className="insurer-account-table__copy" role="cell">
        <UserInsurerAccountCopyButton value={draft.loginId} disabled={pending} label="아이디" />
      </div>
      <div className="insurer-account-table__field" role="cell">
        <FormInput
          type="text"
          value={draft.loginPassword}
          onChange={(event) => setDraft((prev) => ({ ...prev, loginPassword: event.target.value }))}
          placeholder="비밀번호"
          disabled={pending}
          autoComplete="off"
        />
      </div>
      <div className="insurer-account-table__copy" role="cell">
        <UserInsurerAccountCopyButton value={draft.loginPassword} disabled={pending} label="비밀번호" />
      </div>
      <div className="insurer-account-table__saved-at" role="cell">
        {formatAccountSavedAt(row)}
      </div>
      <div className="insurer-account-table__action" role="cell">
        <div className="insurer-account-table__action-group">
          <FormButton
            htmlType="button"
            variant="primary"
            size="sm"
            className="insurer-account-table__save-btn"
            disabled={pending}
            onClick={handleSave}
          >
            저장
          </FormButton>
          {row.isCustom ? (
            <button
              type="button"
              className="insurer-account-delete-button"
              disabled={pending}
              onClick={onDelete}
            >
              삭제
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function AccountSection({
  title,
  category,
  rows,
  pendingId,
  onAdd,
  onSave,
  onDelete,
}: AccountSectionProps) {
  const sectionModifier = SECTION_MODIFIER[category]

  return (
    <section
      className={`user-insurer-accounts-section user-insurer-accounts-section--${sectionModifier}`}
      aria-label={title}
    >
      <header className="user-insurer-accounts-section__banner">
        <h2 className="user-insurer-accounts-section__title">{title}</h2>
      </header>
      <div className="user-insurer-accounts-section__body">
        <div className="user-insurer-accounts-section__toolbar">
          <FormButton htmlType="button" variant="secondary" size="sm" onClick={onAdd}>
            {USER_INSURER_ACCOUNT_ADD_LABEL[category]}
          </FormButton>
        </div>
        {rows.length === 0 ? (
          <p className="user-insurer-accounts-page__muted">{USER_INSURER_ACCOUNT_EMPTY_LABEL[category]}</p>
        ) : (
          <div className="insurer-account-table-scroll">
            <div className="insurer-account-table" role="table">
              <div className="insurer-account-table__header" role="row">
                <span role="columnheader">회사</span>
                <span role="columnheader">아이디</span>
                <span role="columnheader" aria-hidden="true" />
                <span role="columnheader">비번</span>
                <span role="columnheader" aria-hidden="true" />
                <span role="columnheader">저장일</span>
                <span role="columnheader">작업</span>
              </div>
              <div className="insurer-account-table__body" role="rowgroup">
                {rows.map((row) => (
                  <AccountRowEditor
                    key={row.id}
                    row={row}
                    pending={pendingId === row.id}
                    onSave={(patch) => onSave(row, patch)}
                    onDelete={() => onDelete(row)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

type UserInsurerAccountsPanelProps = UserInsurerAccountsViewProps & {
  layout: 'dual-column' | 'stacked'
}

export function UserInsurerAccountsPanel({
  layout,
  activeTab,
  setActiveTab,
  lifeAccounts,
  nonLifeAccounts,
  generalAccounts,
  loading,
  error,
  pendingId,
  addOpen,
  addForm,
  setAddForm,
  saveAccountField,
  removeAccount,
  openAddModal,
  closeAddModal,
  submitAdd,
}: UserInsurerAccountsPanelProps) {
  const showTabs = layout === 'stacked'
  const stackedCategory = activeTab
  const stackedTitle =
    USER_INSURER_ACCOUNT_TABS.find((tab) => tab.value === stackedCategory)?.label ?? '생명보험'
  const stackedRows =
    stackedCategory === 'LIFE'
      ? lifeAccounts
      : stackedCategory === 'NON_LIFE'
        ? nonLifeAccounts
        : generalAccounts

  return (
    <div className="user-insurer-accounts-page__panel">
      {showTabs ? (
        <div className="user-insurer-accounts-page__tabs">
          {USER_INSURER_ACCOUNT_TABS.map((tab) => (
            <FormButton
              key={tab.value}
              htmlType="button"
              variant={activeTab === tab.value ? 'primary' : 'secondary'}
              onClick={() => setActiveTab(tab.value as UserInsurerAccountCategory)}
            >
              {tab.label}
            </FormButton>
          ))}
        </div>
      ) : null}

      {loading ? <p className="user-insurer-accounts-page__muted">불러오는 중…</p> : null}
      {error ? (
        <p className="user-insurer-accounts-page__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && layout === 'dual-column' ? (
        <div className="user-insurer-accounts-grid user-insurer-account-board">
          <AccountSection
            title="생명보험"
            category="LIFE"
            rows={lifeAccounts}
            pendingId={pendingId}
            onAdd={() => openAddModal('LIFE')}
            onSave={(row, patch) => void saveAccountField(row, patch)}
            onDelete={(row) => void removeAccount(row)}
          />
          <AccountSection
            title="손해보험"
            category="NON_LIFE"
            rows={nonLifeAccounts}
            pendingId={pendingId}
            onAdd={() => openAddModal('NON_LIFE')}
            onSave={(row, patch) => void saveAccountField(row, patch)}
            onDelete={(row) => void removeAccount(row)}
          />
          <AccountSection
            title="일반"
            category="GENERAL"
            rows={generalAccounts}
            pendingId={pendingId}
            onAdd={() => openAddModal('GENERAL')}
            onSave={(row, patch) => void saveAccountField(row, patch)}
            onDelete={(row) => void removeAccount(row)}
          />
        </div>
      ) : null}

      {!loading && layout === 'stacked' ? (
        <AccountSection
          title={stackedTitle}
          category={stackedCategory}
          rows={stackedRows}
          pendingId={pendingId}
          onAdd={() => openAddModal(stackedCategory)}
          onSave={(row, patch) => void saveAccountField(row, patch)}
          onDelete={(row) => void removeAccount(row)}
        />
      ) : null}

      <BaseDialog
        open={addOpen}
        onClose={closeAddModal}
        ariaLabel="계정 추가"
        closeOnBackdrop={false}
        panelPreset="largeForm"
        onEscapeRequest={closeAddModal}
      >
        <div className="user-insurer-accounts-page__add-modal">
          <header className="user-insurer-accounts-page__add-modal-header">
            <h2>{USER_INSURER_ACCOUNT_ADD_LABEL[activeTab]}</h2>
          </header>
          <div className="user-insurer-accounts-page__add-modal-body">
            <label className="user-insurer-accounts-page__field">
              <span>회사명</span>
              <FormInput
                value={addForm.companyName}
                onChange={(event) => setAddForm({ ...addForm, companyName: event.target.value })}
                placeholder="회사명"
              />
            </label>
            <label className="user-insurer-accounts-page__field">
              <span>아이디</span>
              <FormInput
                value={addForm.loginId}
                onChange={(event) => setAddForm({ ...addForm, loginId: event.target.value })}
                placeholder="아이디"
              />
            </label>
            <label className="user-insurer-accounts-page__field">
              <span>비밀번호</span>
              <FormInput
                type="text"
                value={addForm.loginPassword}
                onChange={(event) => setAddForm({ ...addForm, loginPassword: event.target.value })}
                placeholder="비밀번호"
                autoComplete="new-password"
              />
            </label>
          </div>
          <footer className="user-insurer-accounts-page__add-modal-footer">
            <FormButton htmlType="button" variant="secondary" onClick={closeAddModal}>
              취소
            </FormButton>
            <FormButton
              htmlType="button"
              variant="primary"
              disabled={pendingId === 'new'}
              onClick={() => void submitAdd()}
            >
              추가
            </FormButton>
          </footer>
        </div>
      </BaseDialog>
    </div>
  )
}

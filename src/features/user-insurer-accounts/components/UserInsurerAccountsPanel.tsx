import { useEffect, useState } from 'react'
import { FormButton, FormInput, FormTextarea } from '../../../components/form'
import { BaseDialog } from '../../../components/dialog/BaseDialog'
import {
  USER_INSURER_ACCOUNT_ADD_LABEL,
  USER_INSURER_ACCOUNT_TABS,
  type UserInsurerAccountCategory,
} from '../config/userInsurerAccounts.config'
import type { UserInsurerAccountsViewProps } from '../hooks/useUserInsurerAccountsState'
import type { UserInsurerAccountRow } from '../api/userInsurerAccountsApi'

type LocalDraft = {
  loginId: string
  loginPassword: string
  memo: string
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
    memo: row.memo,
  })

  useEffect(() => {
    setDraft({
      loginId: row.loginId,
      loginPassword: row.loginPassword,
      memo: row.memo,
    })
  }, [row.id, row.loginId, row.loginPassword, row.memo, row.updatedAt])

  const handleSave = () => {
    onSave({
      loginId: draft.loginId,
      loginPassword: draft.loginPassword,
      memo: draft.memo,
    })
  }

  return (
    <tr className="user-insurer-accounts-page__row">
      <td className="user-insurer-accounts-page__company">{row.companyName}</td>
      <td>
        <FormInput
          value={draft.loginId}
          onChange={(event) => setDraft((prev) => ({ ...prev, loginId: event.target.value }))}
          placeholder="아이디"
          disabled={pending}
        />
      </td>
      <td>
        <FormInput
          type="text"
          value={draft.loginPassword}
          onChange={(event) => setDraft((prev) => ({ ...prev, loginPassword: event.target.value }))}
          placeholder="비밀번호"
          disabled={pending}
          autoComplete="off"
        />
      </td>
      <td>
        <FormTextarea
          value={draft.memo}
          onChange={(event) => setDraft((prev) => ({ ...prev, memo: event.target.value }))}
          placeholder="메모"
          rows={2}
          disabled={pending}
        />
      </td>
      <td className="user-insurer-accounts-page__actions-cell">
        <div className="user-insurer-accounts-page__row-actions">
          <FormButton htmlType="button" variant="primary" size="sm" disabled={pending} onClick={handleSave}>
            저장
          </FormButton>
          {row.isCustom ? (
            <FormButton htmlType="button" variant="secondary" size="sm" disabled={pending} onClick={onDelete}>
              삭제
            </FormButton>
          ) : null}
        </div>
      </td>
    </tr>
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
  return (
    <section className="user-insurer-accounts-section" aria-label={title}>
      <header className="user-insurer-accounts-section__header">
        <h2 className="user-insurer-accounts-section__title">{title}</h2>
        <FormButton htmlType="button" variant="secondary" size="sm" onClick={onAdd}>
          {USER_INSURER_ACCOUNT_ADD_LABEL[category]}
        </FormButton>
      </header>
      {rows.length === 0 ? (
        <p className="user-insurer-accounts-page__muted">등록된 계정 정보가 없습니다.</p>
      ) : (
        <div className="user-insurer-accounts-page__table-wrap">
          <table className="user-insurer-accounts-page__table">
            <colgroup>
              <col className="user-insurer-accounts-page__col-company" />
              <col className="user-insurer-accounts-page__col-login-id" />
              <col className="user-insurer-accounts-page__col-password" />
              <col className="user-insurer-accounts-page__col-memo" />
              <col className="user-insurer-accounts-page__col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>회사</th>
                <th>아이디</th>
                <th>비번</th>
                <th>메모</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <AccountRowEditor
                  key={row.id}
                  row={row}
                  pending={pendingId === row.id}
                  onSave={(patch) => onSave(row, patch)}
                  onDelete={() => onDelete(row)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
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

  return (
    <div className="user-insurer-accounts-page__panel">
      {showTabs ? (
        <>
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
          <div className="user-insurer-accounts-page__toolbar">
            <FormButton htmlType="button" variant="secondary" onClick={() => openAddModal(activeTab)}>
              {USER_INSURER_ACCOUNT_ADD_LABEL[activeTab]}
            </FormButton>
          </div>
        </>
      ) : null}

      {loading ? <p className="user-insurer-accounts-page__muted">불러오는 중…</p> : null}
      {error ? (
        <p className="user-insurer-accounts-page__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && layout === 'dual-column' ? (
        <div className="user-insurer-accounts-grid">
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
        </div>
      ) : null}

      {!loading && layout === 'stacked' ? (
        <div className="user-insurer-accounts-stack">
          {(activeTab === 'LIFE' ? lifeAccounts : nonLifeAccounts).length === 0 ? (
            <p className="user-insurer-accounts-page__muted">등록된 계정 정보가 없습니다.</p>
          ) : (
            <div className="user-insurer-accounts-page__table-wrap">
              <table className="user-insurer-accounts-page__table">
                <colgroup>
                  <col className="user-insurer-accounts-page__col-company" />
                  <col className="user-insurer-accounts-page__col-login-id" />
                  <col className="user-insurer-accounts-page__col-password" />
                  <col className="user-insurer-accounts-page__col-memo" />
                  <col className="user-insurer-accounts-page__col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th>회사</th>
                    <th>아이디</th>
                    <th>비번</th>
                    <th>메모</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeTab === 'LIFE' ? lifeAccounts : nonLifeAccounts).map((row) => (
                    <AccountRowEditor
                      key={row.id}
                      row={row}
                      pending={pendingId === row.id}
                      onSave={(patch) => void saveAccountField(row, patch)}
                      onDelete={() => void removeAccount(row)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
            <label className="user-insurer-accounts-page__field">
              <span>메모</span>
              <FormTextarea
                value={addForm.memo}
                onChange={(event) => setAddForm({ ...addForm, memo: event.target.value })}
                placeholder="메모"
                rows={3}
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

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
          type="password"
          value={draft.loginPassword}
          onChange={(event) => setDraft((prev) => ({ ...prev, loginPassword: event.target.value }))}
          placeholder="비번"
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
      <td>
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

export function UserInsurerAccountsPanel(props: UserInsurerAccountsViewProps) {
  const {
    activeTab,
    setActiveTab,
    accounts,
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
  } = props

  return (
    <div className="user-insurer-accounts-page__panel">
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
        <FormButton htmlType="button" variant="secondary" onClick={openAddModal}>
          {USER_INSURER_ACCOUNT_ADD_LABEL[activeTab]}
        </FormButton>
      </div>

      {loading ? <p className="user-insurer-accounts-page__muted">불러오는 중…</p> : null}
      {error ? (
        <p className="user-insurer-accounts-page__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && accounts.length === 0 ? (
        <p className="user-insurer-accounts-page__muted">등록된 계정 정보가 없습니다.</p>
      ) : (
        <div className="user-insurer-accounts-page__table-wrap">
          <table className="user-insurer-accounts-page__table">
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
              {accounts.map((row) => (
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
              <span>비번</span>
              <FormInput
                type="password"
                value={addForm.loginPassword}
                onChange={(event) => setAddForm({ ...addForm, loginPassword: event.target.value })}
                placeholder="비번"
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

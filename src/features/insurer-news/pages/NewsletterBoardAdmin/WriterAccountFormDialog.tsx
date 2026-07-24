import { FormButton, FormInput, FormSelect, FieldWrapper } from '../../../../components/form'
import { FormDialog } from '../../../../components/dialog'

export type WriterAccountFormState = {
  organizationName: string
  authorName: string
  loginId: string
  password: string
  passwordConfirm: string
  isActive: boolean
}

type WriterAccountFormDialogProps = {
  mode: 'create' | 'edit'
  open: boolean
  busy: boolean
  form: WriterAccountFormState
  formError: string
  checkMessage: string
  loginIdAvailable: boolean | null
  onClose: () => void
  onChangeOrganizationName: (value: string) => void
  onChangeAuthorName: (value: string) => void
  onChangeLoginId: (value: string) => void
  onChangePassword: (value: string) => void
  onChangePasswordConfirm: (value: string) => void
  onChangeIsActive: (value: boolean) => void
  onCheckLoginId: () => void
  onSubmit: () => void
}

const STATUS_OPTIONS = [
  { value: 'true', label: '정상 (ACTIVE)' },
  { value: 'false', label: '사용 중지 (INACTIVE)' },
]

export function WriterAccountFormDialog({
  mode,
  open,
  busy,
  form,
  formError,
  checkMessage,
  loginIdAvailable,
  onClose,
  onChangeOrganizationName,
  onChangeAuthorName,
  onChangeLoginId,
  onChangePassword,
  onChangePasswordConfirm,
  onChangeIsActive,
  onCheckLoginId,
  onSubmit,
}: WriterAccountFormDialogProps) {
  const title = mode === 'create' ? '작성자 계정 등록' : '작성자 계정 수정'

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={title}
      panelClassName="admin-modal-panel"
      overlayClassName="admin-modal-backdrop"
      closeOnBackdrop={false}
      closeOnEsc={false}
    >
      <form
        className="admin-modal-content"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        {formError ? <p className="status status--error" style={{ margin: 0 }}>{formError}</p> : null}

        <FieldWrapper label="소속명" className="admin-modal-field">
          <FormInput
            className="admin-form-input"
            value={form.organizationName}
            onChange={(event) => onChangeOrganizationName(event.target.value)}
            required
            autoComplete="off"
            disabled={busy}
          />
        </FieldWrapper>

        <FieldWrapper label="작성자 이름" className="admin-modal-field">
          <FormInput
            className="admin-form-input"
            value={form.authorName}
            onChange={(event) => onChangeAuthorName(event.target.value)}
            required
            autoComplete="off"
            disabled={busy}
          />
        </FieldWrapper>

        <FieldWrapper label="아이디" className="admin-modal-field">
          <div className="newsletter-board-writer-panel__login-row">
            <FormInput
              className="admin-form-input"
              value={form.loginId}
              onChange={(event) => onChangeLoginId(event.target.value)}
              required
              autoComplete="off"
              disabled={busy}
            />
            <FormButton
              htmlType="button"
              variant="secondary"
              className="button button--secondary"
              disabled={busy || !form.loginId.trim()}
              onClick={onCheckLoginId}
            >
              중복 확인
            </FormButton>
          </div>
          {checkMessage ? (
            <span
              className={
                loginIdAvailable
                  ? 'newsletter-board-writer-panel__check newsletter-board-writer-panel__check--ok'
                  : 'newsletter-board-writer-panel__check newsletter-board-writer-panel__check--bad'
              }
            >
              {checkMessage}
            </span>
          ) : null}
        </FieldWrapper>

        <FieldWrapper
          label={mode === 'create' ? '비밀번호' : '새 비밀번호'}
          className="admin-modal-field"
        >
          <FormInput
            className="admin-form-input"
            type="password"
            value={form.password}
            onChange={(event) => onChangePassword(event.target.value)}
            required={mode === 'create'}
            autoComplete="new-password"
            disabled={busy}
            placeholder={mode === 'edit' ? '비밀번호를 변경하지 않으려면 비워 두세요.' : undefined}
          />
        </FieldWrapper>

        <FieldWrapper
          label={mode === 'create' ? '비밀번호 확인' : '새 비밀번호 확인'}
          className="admin-modal-field"
        >
          <FormInput
            className="admin-form-input"
            type="password"
            value={form.passwordConfirm}
            onChange={(event) => onChangePasswordConfirm(event.target.value)}
            required={mode === 'create'}
            autoComplete="new-password"
            disabled={busy}
          />
        </FieldWrapper>

        <FieldWrapper label="상태" className="admin-modal-field">
          <FormSelect
            className="admin-form-input"
            value={form.isActive ? 'true' : 'false'}
            onChange={(event) => onChangeIsActive(event.target.value === 'true')}
            options={STATUS_OPTIONS}
            disabled={busy}
          />
        </FieldWrapper>

        <div className="admin-modal-actions">
          <FormButton
            htmlType="button"
            variant="secondary"
            className="button button--secondary"
            disabled={busy}
            onClick={onClose}
          >
            취소
          </FormButton>
          <FormButton htmlType="submit" variant="primary" className="button button--primary" disabled={busy}>
            {busy ? '저장 중...' : mode === 'create' ? '등록' : '저장'}
          </FormButton>
        </div>
      </form>
    </FormDialog>
  )
}

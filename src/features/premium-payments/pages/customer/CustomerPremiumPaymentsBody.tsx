import { FormButton, FormInput, FormTextarea } from '../../../../components/form'
import { FormDialog } from '../../../../components/dialog'
import type { CustomerPremiumPaymentsViewProps } from './customerPremiumPaymentsViewProps'
import type { PremiumPaymentMethodRow } from '../../api/premiumPaymentsApi'
import '../../premium-payments.css'

function PaymentRowCard({
  row,
  formatCardExpiry,
  busy,
  onEdit,
  onCopyPolicy,
  onCopyExpiry,
  onReveal,
  onDisable,
  onEnable,
}: {
  row: PremiumPaymentMethodRow
  formatCardExpiry: (month: number, year: number) => string
  busy: boolean
  onEdit: () => void
  onCopyPolicy: () => void
  onCopyExpiry: () => void
  onReveal: () => void
  onDisable: () => void
  onEnable: () => void
}) {
  return (
    <article
      className={`premium-payment-card${row.isActive ? '' : ' premium-payment-card--inactive'}`}
    >
      <div className="premium-payment-card__head">
        <strong>{row.insuranceCompany || '보험회사 미입력'}</strong>
        <span className={`premium-payment-card__badge${row.isActive ? '' : ' is-off'}`}>
          {row.isActive ? '사용중' : '중지'}
        </span>
      </div>
      <dl className="premium-payment-card__meta">
        <div>
          <dt>증권번호</dt>
          <dd>
            <button type="button" className="premium-payment-card__linkish" onClick={onCopyPolicy}>
              {row.policyNumber || '-'}
            </button>
          </dd>
        </div>
        <div>
          <dt>명의자</dt>
          <dd>{row.cardholderName || '-'}</dd>
        </div>
        <div>
          <dt>카드번호</dt>
          <dd>{row.maskedCardNumber}</dd>
        </div>
        <div>
          <dt>유효기간</dt>
          <dd>
            <button type="button" className="premium-payment-card__linkish" onClick={onCopyExpiry}>
              {formatCardExpiry(row.cardExpiryMonth, row.cardExpiryYear)}
            </button>
          </dd>
        </div>
        {row.memo ? (
          <div className="premium-payment-card__memo">
            <dt>메모</dt>
            <dd>{row.memo}</dd>
          </div>
        ) : null}
      </dl>
      <div className="premium-payment-card__actions">
        <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={onEdit}>
          수정
        </FormButton>
        <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={onReveal}>
          카드번호 확인
        </FormButton>
        {row.isActive ? (
          <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={onDisable}>
            사용 중지
          </FormButton>
        ) : (
          <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={onEnable}>
            다시 사용
          </FormButton>
        )}
      </div>
    </article>
  )
}

export function CustomerPremiumPaymentsBody({
  customerId: _customerId,
  state,
  onConfirmDisable,
  onConfirmEnable,
}: CustomerPremiumPaymentsViewProps) {
  const {
    rows,
    error,
    busy,
    notFound,
    formOpen,
    editing,
    form,
    setForm,
    copyHint,
    revealOpen,
    revealTarget,
    revealPassword,
    setRevealPassword,
    revealedCardNumber,
    revealError,
    formatCardExpiry,
    openCreate,
    openEdit,
    closeForm,
    submitForm,
    copyField,
    openReveal,
    closeReveal,
    submitReveal,
    copyRevealedCard,
  } = state

  return (
    <>
      <div className="premium-payments-toolbar">
        <FormButton htmlType="button" variant="primary" disabled={busy || notFound} onClick={openCreate}>
          결제 정보 등록
        </FormButton>
        {copyHint ? <span className="premium-payments-hint">{copyHint}</span> : null}
      </div>

      {error ? <p className="premium-payments-error">{error}</p> : null}
      {notFound ? <p className="premium-payments-empty">고객을 찾을 수 없습니다.</p> : null}
      {!notFound && rows.length === 0 ? (
        <p className="premium-payments-empty">등록된 보험료 결제 정보가 없습니다.</p>
      ) : null}

      <div className="premium-payments-list">
        {rows.map((row) => (
          <PaymentRowCard
            key={row.id}
            row={row}
            formatCardExpiry={formatCardExpiry}
            busy={busy}
            onEdit={() => openEdit(row)}
            onCopyPolicy={() => void copyField('증권번호', row.policyNumber)}
            onCopyExpiry={() =>
              void copyField('유효기간', formatCardExpiry(row.cardExpiryMonth, row.cardExpiryYear))
            }
            onReveal={() => openReveal(row)}
            onDisable={() => void onConfirmDisable(row.id)}
            onEnable={() => void onConfirmEnable(row.id)}
          />
        ))}
      </div>

      <FormDialog
        open={formOpen}
        onClose={closeForm}
        title={editing ? '보험료 결제 정보 수정' : '보험료 결제 정보 등록'}
        closeOnBackdrop={!busy}
        closeOnEsc={!busy}
        footer={
          <div className="premium-payments-dialog-footer">
            <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={closeForm}>
              취소
            </FormButton>
            <FormButton htmlType="submit" form="premium-payment-form" variant="primary" disabled={busy}>
              {busy ? '저장 중…' : '저장'}
            </FormButton>
          </div>
        }
      >
        <form id="premium-payment-form" className="premium-payments-form" onSubmit={submitForm}>
          <label className="premium-payments-field">
            <span>보험회사</span>
            <FormInput
              value={form.insuranceCompany}
              onChange={(e) => setForm((prev) => ({ ...prev, insuranceCompany: e.target.value }))}
              required
            />
          </label>
          <label className="premium-payments-field">
            <span>증권번호</span>
            <FormInput
              value={form.policyNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, policyNumber: e.target.value }))}
              required
            />
          </label>
          <label className="premium-payments-field">
            <span>카드 명의자</span>
            <FormInput
              value={form.cardholderName}
              onChange={(e) => setForm((prev) => ({ ...prev, cardholderName: e.target.value }))}
              required
            />
          </label>
          <label className="premium-payments-field">
            <span>카드번호{editing ? ' (변경 시에만 입력)' : ''}</span>
            <FormInput
              value={form.cardNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, cardNumber: e.target.value }))}
              inputMode="numeric"
              autoComplete="off"
              placeholder={editing ? `현재 카드: ${editing.maskedCardNumber}` : '숫자만 입력'}
              required={!editing}
            />
          </label>
          <div className="premium-payments-form__expiry">
            <label className="premium-payments-field">
              <span>유효월</span>
              <FormInput
                value={form.cardExpiryMonth}
                onChange={(e) => setForm((prev) => ({ ...prev, cardExpiryMonth: e.target.value }))}
                inputMode="numeric"
                placeholder="MM"
                required
              />
            </label>
            <label className="premium-payments-field">
              <span>유효연도</span>
              <FormInput
                value={form.cardExpiryYear}
                onChange={(e) => setForm((prev) => ({ ...prev, cardExpiryYear: e.target.value }))}
                inputMode="numeric"
                placeholder="YYYY"
                required
              />
            </label>
          </div>
          <label className="premium-payments-field">
            <span>메모</span>
            <FormTextarea
              value={form.memo}
              onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))}
              rows={3}
            />
          </label>
        </form>
      </FormDialog>

      <FormDialog
        open={revealOpen}
        onClose={closeReveal}
        title="카드번호 확인"
        closeOnBackdrop={!busy}
        closeOnEsc={!busy}
        footer={
          <div className="premium-payments-dialog-footer">
            <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={closeReveal}>
              닫기
            </FormButton>
            {revealedCardNumber ? (
              <FormButton htmlType="button" variant="primary" disabled={busy} onClick={() => void copyRevealedCard()}>
                복사
              </FormButton>
            ) : (
              <FormButton htmlType="submit" form="premium-payment-reveal-form" variant="primary" disabled={busy}>
                확인
              </FormButton>
            )}
          </div>
        }
      >
        <form id="premium-payment-reveal-form" className="premium-payments-form" onSubmit={submitReveal}>
          <p className="premium-payments-reveal-lead">
            {revealTarget
              ? `${revealTarget.insuranceCompany} · ${revealTarget.maskedCardNumber}`
              : ''}
          </p>
          {revealedCardNumber ? (
            <p className="premium-payments-reveal-value">{revealedCardNumber}</p>
          ) : (
            <label className="premium-payments-field">
              <span>로그인 비밀번호 재확인</span>
              <FormInput
                type="password"
                value={revealPassword}
                onChange={(e) => setRevealPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
          )}
          {revealError ? <p className="premium-payments-error">{revealError}</p> : null}
        </form>
      </FormDialog>
    </>
  )
}

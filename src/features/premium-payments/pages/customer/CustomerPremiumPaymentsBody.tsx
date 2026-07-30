import { FormDialog } from '../../../../components/dialog'
import { FormButton, FormInput, FormSelect } from '../../../../components/form'
import {
  formatLastCompletedAt,
  formatPaymentDay,
  formatPremiumAmount,
  monthStatusLabel,
} from '../../api/premiumPaymentsApi'
import type { CustomerPremiumPaymentsViewProps } from './customerPremiumPaymentsViewProps'

const paymentDayOptions = [
  { value: '', label: '결제일 미입력' },
  ...Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1),
    label: `매월 ${i + 1}일`,
  })),
]

export function CustomerPremiumPaymentsBody({
  customerName,
  state,
  onConfirmDeleteCard,
  onConfirmDeleteContract,
  onConfirmComplete,
  onConfirmReopen,
}: CustomerPremiumPaymentsViewProps) {
  const {
    cards,
    contracts,
    error,
    busy,
    notFound,
    copyHint,
    cardFormOpen,
    editingCard,
    cardForm,
    setCardForm,
    openCreateCard,
    openEditCard,
    closeCardForm,
    submitCardForm,
    contractFormOpen,
    editingContract,
    contractForm,
    setContractForm,
    openCreateContract,
    openEditContract,
    closeContractForm,
    submitContractForm,
    copyPolicyNumber,
    copyCardNumber,
    copyCardExpiry,
    cardOptions,
  } = state

  if (notFound) {
    return <p className="premium-payments-page__error">고객을 찾을 수 없습니다.</p>
  }

  return (
    <div className="premium-payments-page__workspace">
      <p className="premium-payments-page__desc">
        카드로 직접 수납해야 하는 보험계약과 고객 카드정보를 관리합니다.
      </p>
      {error ? (
        <p className="premium-payments-page__error" role="alert">
          {error}
        </p>
      ) : null}
      {copyHint ? <p className="premium-payments-page__hint">{copyHint}</p> : null}

      <section className="premium-payments-section" aria-labelledby="card-info-heading">
        <div className="premium-payments-section__header">
          <h2 id="card-info-heading">카드정보</h2>
          <FormButton htmlType="button" variant="primary" size="sm" onClick={openCreateCard} disabled={busy}>
            카드정보 등록
          </FormButton>
        </div>
        {cards.length === 0 ? (
          <p className="premium-payments-page__empty">등록된 카드정보가 없습니다.</p>
        ) : (
          <ul className="premium-payments-card-list">
            {cards.map((card) => (
              <li key={card.id} className="premium-payments-card-list__item">
                <div className="premium-payments-card-list__meta">
                  <strong>{card.label || '카드'}</strong>
                  <span>소유주: {card.cardOwnerName}</span>
                  <span>
                    카드번호: {card.cardNumberDisplay ?? '-'}{' '}
                    <FormButton
                      htmlType="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void copyCardNumber(card.cardNumber)}
                    >
                      복사
                    </FormButton>
                  </span>
                  <span>
                    유효기간: {card.cardExpiry}{' '}
                    <FormButton
                      htmlType="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void copyCardExpiry(card.cardExpiry)}
                    >
                      복사
                    </FormButton>
                  </span>
                </div>
                <div className="premium-payments-card-list__actions">
                  <FormButton htmlType="button" variant="secondary" size="sm" onClick={() => openEditCard(card)}>
                    수정
                  </FormButton>
                  <FormButton
                    htmlType="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void onConfirmDeleteCard(card.id)}
                  >
                    삭제
                  </FormButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="premium-payments-section" aria-labelledby="contract-heading">
        <div className="premium-payments-section__header">
          <h2 id="contract-heading">카드 수납 대상</h2>
          <FormButton
            htmlType="button"
            variant="primary"
            size="sm"
            onClick={openCreateContract}
            disabled={busy}
          >
            수납 대상 추가
          </FormButton>
        </div>
        {contracts.length === 0 ? (
          <p className="premium-payments-page__empty">등록된 수납 대상이 없습니다.</p>
        ) : (
          <div className="premium-payments-table-wrap">
            <table className="premium-payments-table">
              <thead>
                <tr>
                  <th>보험회사</th>
                  <th>증권번호</th>
                  <th>상품명</th>
                  <th>보험료</th>
                  <th>결제일</th>
                  <th>사용 카드</th>
                  <th>최근 처리일</th>
                  <th>상태</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((row) => (
                  <tr key={row.id}>
                    <td>{row.insuranceCompany}</td>
                    <td>
                      {row.policyNumber ? (
                        <>
                          {row.policyNumber}{' '}
                          <FormButton
                            htmlType="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void copyPolicyNumber(row.policyNumber)}
                          >
                            복사
                          </FormButton>
                        </>
                      ) : (
                        '증권번호 없음'
                      )}
                    </td>
                    <td>{row.productName || '-'}</td>
                    <td>{formatPremiumAmount(row.premiumAmount)}</td>
                    <td>{formatPaymentDay(row.paymentDay)}</td>
                    <td>
                      {row.card ? (
                        <div className="premium-payments-inline-actions">
                          <span>
                            {row.card.label || '카드'} · 끝 {row.card.cardNumberLast4}
                          </span>
                          <FormButton
                            htmlType="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void copyCardNumber(row.card?.cardNumber)}
                          >
                            카드번호 복사
                          </FormButton>
                          <FormButton
                            htmlType="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void copyCardExpiry(row.card?.cardExpiry)}
                          >
                            유효기간 복사
                          </FormButton>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{formatLastCompletedAt(row.lastCompletedAt || row.monthCompletedAt)}</td>
                    <td>{monthStatusLabel(row.monthStatus)}</td>
                    <td>
                      <div className="premium-payments-inline-actions">
                        {row.monthStatus === 'PENDING' ? (
                          <FormButton
                            htmlType="button"
                            variant="primary"
                            size="sm"
                            onClick={() => void onConfirmComplete(row.id)}
                          >
                            처리 완료
                          </FormButton>
                        ) : (
                          <FormButton
                            htmlType="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void onConfirmReopen(row.id)}
                          >
                            처리 필요로 변경
                          </FormButton>
                        )}
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditContract(row)}
                        >
                          수정
                        </FormButton>
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void onConfirmDeleteContract(row.id)}
                        >
                          삭제
                        </FormButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <FormDialog
        open={cardFormOpen}
        onClose={closeCardForm}
        title={editingCard ? '카드정보 수정' : '카드정보 등록'}
        closeOnBackdrop={false}
        panelPreset="largeForm"
        footer={
          <>
            <FormButton htmlType="button" variant="secondary" onClick={closeCardForm} disabled={busy}>
              취소
            </FormButton>
            <FormButton htmlType="submit" form="card-payment-card-form" variant="primary" disabled={busy}>
              저장
            </FormButton>
          </>
        }
      >
        <form id="card-payment-card-form" className="premium-payments-form" onSubmit={submitCardForm}>
          <label>
            카드 구분명
            <FormInput
              value={cardForm.label}
              onChange={(e) => setCardForm((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="본인카드"
            />
          </label>
          <label>
            카드 소유주
            <FormInput
              value={cardForm.cardOwnerName}
              onChange={(e) => setCardForm((prev) => ({ ...prev, cardOwnerName: e.target.value }))}
              placeholder={customerName || '소유주'}
              required
            />
          </label>
          <label>
            카드번호{editingCard ? ' (변경 시에만 입력)' : ''}
            <FormInput
              value={cardForm.cardNumber}
              onChange={(e) => setCardForm((prev) => ({ ...prev, cardNumber: e.target.value }))}
              placeholder={editingCard ? `현재 끝 ${editingCard.cardNumberLast4}` : '숫자·하이픈 붙여넣기 가능'}
              required={!editingCard}
              autoComplete="off"
            />
          </label>
          <div className="premium-payments-form__row">
            <label>
              유효기간(월)
              <FormInput
                value={cardForm.cardExpiryMonth}
                onChange={(e) => setCardForm((prev) => ({ ...prev, cardExpiryMonth: e.target.value }))}
                placeholder="08"
                required
              />
            </label>
            <label>
              유효기간(연)
              <FormInput
                value={cardForm.cardExpiryYear}
                onChange={(e) => setCardForm((prev) => ({ ...prev, cardExpiryYear: e.target.value }))}
                placeholder="2029"
                required
              />
            </label>
          </div>
        </form>
      </FormDialog>

      <FormDialog
        open={contractFormOpen}
        onClose={closeContractForm}
        title={editingContract ? '카드 수납 대상 수정' : '카드 수납 대상 추가'}
        closeOnBackdrop={false}
        panelPreset="largeForm"
        footer={
          <>
            <FormButton htmlType="button" variant="secondary" onClick={closeContractForm} disabled={busy}>
              취소
            </FormButton>
            <FormButton htmlType="submit" form="card-payment-contract-form" variant="primary" disabled={busy}>
              저장
            </FormButton>
          </>
        }
      >
        <form
          id="card-payment-contract-form"
          className="premium-payments-form"
          onSubmit={submitContractForm}
        >
          <label>
            보험회사 *
            <FormInput
              value={contractForm.insuranceCompany}
              onChange={(e) => setContractForm((prev) => ({ ...prev, insuranceCompany: e.target.value }))}
              required
            />
          </label>
          <label>
            증권번호
            <FormInput
              value={contractForm.policyNumber}
              onChange={(e) => setContractForm((prev) => ({ ...prev, policyNumber: e.target.value }))}
            />
          </label>
          <label>
            상품명
            <FormInput
              value={contractForm.productName}
              onChange={(e) => setContractForm((prev) => ({ ...prev, productName: e.target.value }))}
            />
          </label>
          <label>
            보험료
            <FormInput
              value={contractForm.premiumAmount}
              onChange={(e) => setContractForm((prev) => ({ ...prev, premiumAmount: e.target.value }))}
              placeholder="125000"
            />
          </label>
          <label>
            결제일
            <FormSelect
              value={contractForm.paymentDay}
              onChange={(e) => setContractForm((prev) => ({ ...prev, paymentDay: e.target.value }))}
              options={paymentDayOptions}
            />
          </label>
          <label>
            사용할 카드
            <FormSelect
              value={contractForm.paymentCardId}
              onChange={(e) => setContractForm((prev) => ({ ...prev, paymentCardId: e.target.value }))}
              options={[{ value: '', label: '연결 안 함' }, ...cardOptions]}
            />
          </label>
          <label>
            메모
            <FormInput
              value={contractForm.memo}
              onChange={(e) => setContractForm((prev) => ({ ...prev, memo: e.target.value }))}
            />
          </label>
          <label>
            상태
            <FormSelect
              value={contractForm.status}
              onChange={(e) =>
                setContractForm((prev) => ({
                  ...prev,
                  status: e.target.value === 'PAUSED' ? 'PAUSED' : 'PENDING',
                }))
              }
              options={[
                { value: 'PENDING', label: '처리 필요' },
                { value: 'PAUSED', label: '보류' },
              ]}
            />
          </label>
        </form>
      </FormDialog>
    </div>
  )
}

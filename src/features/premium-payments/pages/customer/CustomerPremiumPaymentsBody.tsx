import { FormButton } from '../../../../components/form'
import { CardPaymentFormDialog } from '../../components/CardPaymentFormDialog'
import { CardPaymentRowActions } from '../../components/CardPaymentRowActions'
import { CollectionTargetForm } from '../../components/CollectionTargetForm'
import { PaymentCardForm } from '../../components/PaymentCardForm'
import { formatPaymentDay, formatPremiumAmount } from '../../api/premiumPaymentsApi'
import { formatLinkedCardLabel } from '../../utils/formatLinkedCardLabel.js'
import type { CustomerPremiumPaymentsViewProps } from './customerPremiumPaymentsViewProps'

export function CustomerPremiumPaymentsBody({
  customerName,
  state,
  onConfirmDeleteCard,
  onConfirmDeleteContract,
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
      <div className="premium-payments-page__top-actions">
        <FormButton htmlType="button" variant="primary" size="sm" onClick={openCreateCard} disabled={busy}>
          카드정보 등록
        </FormButton>
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

      {error ? (
        <p className="premium-payments-page__error" role="alert">
          {error}
        </p>
      ) : null}
      {copyHint ? <p className="premium-payments-page__hint">{copyHint}</p> : null}

      <section className="premium-payments-section" aria-labelledby="card-info-heading">
        <div className="premium-payments-section__header">
          <h2 id="card-info-heading">카드정보</h2>
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
                  <span className="premium-payments-card-list__value-row">
                    카드번호: {card.cardNumberDisplay ?? '-'}
                    <FormButton
                      htmlType="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void copyCardNumber(card.cardNumber)}
                    >
                      복사
                    </FormButton>
                  </span>
                  <span className="premium-payments-card-list__value-row">
                    유효기간: {card.cardExpiry}
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
                  <CardPaymentRowActions
                    disabled={busy}
                    onEdit={() => openEditCard(card)}
                    onDelete={() => void onConfirmDeleteCard(card.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="premium-payments-section" aria-labelledby="contract-heading">
        <div className="premium-payments-section__header">
          <h2 id="contract-heading">카드 수납 대상</h2>
        </div>
        {contracts.length === 0 ? (
          <p className="premium-payments-page__empty">등록된 수납 대상이 없습니다.</p>
        ) : (
          <div className="premium-payments-table-wrap">
            <table className="premium-payments-table">
              <thead>
                <tr>
                  <th className="premium-payments-table__col--company">보험회사</th>
                  <th className="premium-payments-table__col--policy">증권번호</th>
                  <th className="premium-payments-table__col--product">상품명</th>
                  <th className="premium-payments-table__col--amount">보험료</th>
                  <th className="premium-payments-table__col--day">결제일</th>
                  <th className="premium-payments-table__col--card">사용 카드</th>
                  <th className="premium-payments-table__col--actions">관리</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((row) => (
                  <tr key={row.id}>
                    <td className="premium-payments-table__col--company" data-label="보험회사">
                      {row.insuranceCompany}
                    </td>
                    <td className="premium-payments-table__col--policy" data-label="증권번호">
                      {row.policyNumber ? (
                        <span className="premium-payments-card-list__value-row">
                          {row.policyNumber}
                          <FormButton
                            htmlType="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void copyPolicyNumber(row.policyNumber)}
                          >
                            복사
                          </FormButton>
                        </span>
                      ) : (
                        '증권번호 없음'
                      )}
                    </td>
                    <td className="premium-payments-table__col--product" data-label="상품명">
                      {row.productName || '-'}
                    </td>
                    <td className="premium-payments-table__col--amount" data-label="보험료">
                      {formatPremiumAmount(row.premiumAmount)}
                    </td>
                    <td className="premium-payments-table__col--day" data-label="결제일">
                      {formatPaymentDay(row.paymentDay)}
                    </td>
                    <td className="premium-payments-table__col--card" data-label="사용 카드">
                      {formatLinkedCardLabel(row.card)}
                    </td>
                    <td className="premium-payments-table__col--actions" data-label="관리">
                      <CardPaymentRowActions
                        disabled={busy}
                        onEdit={() => openEditContract(row)}
                        onDelete={() => void onConfirmDeleteContract(row.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CardPaymentFormDialog
        open={cardFormOpen}
        onClose={closeCardForm}
        title={editingCard ? '카드정보 수정' : '카드정보 등록'}
        formId="card-payment-card-form"
        formClassName="premium-payments-form--card"
        busy={busy}
        onSubmit={submitCardForm}
      >
        <PaymentCardForm
          value={cardForm}
          onChange={setCardForm}
          editing={Boolean(editingCard)}
          ownerPlaceholder={customerName || '소유주'}
        />
      </CardPaymentFormDialog>

      <CardPaymentFormDialog
        open={contractFormOpen}
        onClose={closeContractForm}
        title={editingContract ? '카드 수납 대상 수정' : '카드 수납 대상 추가'}
        formId="card-payment-contract-form"
        formClassName="premium-payments-form--contract"
        busy={busy}
        onSubmit={submitContractForm}
      >
        <CollectionTargetForm
          value={contractForm}
          onChange={setContractForm}
          cardOptions={cardOptions}
        />
      </CardPaymentFormDialog>
    </div>
  )
}

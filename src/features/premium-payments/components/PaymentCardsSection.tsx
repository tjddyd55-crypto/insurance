import { FormButton } from '../../../components/form'
import type { PaymentCardRow } from '../api/premiumPaymentsApi'
import { CardPaymentRowActions } from './CardPaymentRowActions'
import { InlineCopyValue } from './InlineCopyValue'

type Props = {
  cards: PaymentCardRow[]
  busy: boolean
  actionVariant?: 'workspace' | 'form'
  onCreate: () => void
  onEdit: (card: PaymentCardRow) => void
  onDelete: (cardId: number) => void
  onCopyCardNumber: (digits: string | null | undefined) => void
  onCopyExpiry: (expiry: string | null | undefined) => void
}

/** 카드정보 섹션 — section header 액션 + compact 한 줄 행 */
export function PaymentCardsSection({
  cards,
  busy,
  actionVariant = 'workspace',
  onCreate,
  onEdit,
  onDelete,
  onCopyCardNumber,
  onCopyExpiry,
}: Props) {
  return (
    <section className="premium-payments-section" aria-labelledby="card-info-heading">
      <div className="premium-payments-section__header">
        <h2 id="card-info-heading">카드정보</h2>
        <FormButton htmlType="button" variant="primary" size="sm" onClick={onCreate} disabled={busy}>
          카드정보 등록
        </FormButton>
      </div>
      {cards.length === 0 ? (
        <div className="premium-payments-empty-block">
          <p className="premium-payments-page__empty">등록된 카드정보가 없습니다.</p>
          <FormButton htmlType="button" variant="primary" size="sm" onClick={onCreate} disabled={busy}>
            카드정보 등록
          </FormButton>
        </div>
      ) : (
        <div className="premium-payments-card-table-wrap">
          <table className="premium-payments-card-table">
            <thead>
              <tr>
                <th className="premium-payments-card-table__col--label">카드 구분명</th>
                <th className="premium-payments-card-table__col--owner">카드 소유주</th>
                <th className="premium-payments-card-table__col--number">카드번호</th>
                <th className="premium-payments-card-table__col--expiry">유효기간</th>
                <th className="premium-payments-card-table__col--actions">관리</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.id}>
                  <td className="premium-payments-card-table__col--label" data-label="카드 구분명">
                    <span className="premium-payments-cell-inner">
                      <span className="premium-payments-cell-text">{card.label || '카드'}</span>
                    </span>
                  </td>
                  <td className="premium-payments-card-table__col--owner" data-label="카드 소유주">
                    <span className="premium-payments-cell-inner">
                      <span className="premium-payments-cell-text">{card.cardOwnerName}</span>
                    </span>
                  </td>
                  <td className="premium-payments-card-table__col--number" data-label="카드번호">
                    <span className="premium-payments-cell-inner">
                      <InlineCopyValue
                        value={card.cardNumber || card.cardNumberDisplay}
                        display={card.cardNumberDisplay ?? card.cardNumber}
                        mono
                        emptyLabel="-"
                        onCopy={(trimmed) => onCopyCardNumber(card.cardNumber || trimmed)}
                      />
                    </span>
                  </td>
                  <td className="premium-payments-card-table__col--expiry" data-label="유효기간">
                    <span className="premium-payments-cell-inner">
                      <InlineCopyValue
                        value={card.cardExpiry}
                        emptyLabel="-"
                        onCopy={(trimmed) => onCopyExpiry(trimmed)}
                      />
                    </span>
                  </td>
                  <td className="premium-payments-card-table__col--actions" data-label="관리">
                    <span className="premium-payments-cell-inner premium-payments-cell-inner--center">
                      <CardPaymentRowActions
                        variant={actionVariant}
                        disabled={busy}
                        onEdit={() => onEdit(card)}
                        onDelete={() => onDelete(card.id)}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

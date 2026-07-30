import { FormButton } from '../../../../components/form'
import { CustomerCardPaymentPanels } from '../../components/CustomerCardPaymentPanels'
import type { CustomerCardPaymentState } from '../../hooks/useCustomerPremiumPaymentsState'
import type { CardPaymentCustomerListItem } from '../../hooks/usePremiumPaymentsOverviewState'
import { PremiumPaymentsCustomerSidebar } from './PremiumPaymentsCustomerSidebar'

type Props = {
  search: string
  onSearchChange: (value: string) => void
  customers: CardPaymentCustomerListItem[]
  filteredCustomers: CardPaymentCustomerListItem[]
  listLoading: boolean
  listError: string
  selectedCustomerId: number | null
  selectedCustomer: CardPaymentCustomerListItem | null
  detailState: CustomerCardPaymentState | null
  mobilePickerOpen: boolean
  onOpenMobilePicker: () => void
  onCloseMobilePicker: () => void
  onSelectCustomer: (customerId: number) => void
  onOpenCustomerWorkspace: (customerId: number) => void
  onConfirmDeleteCard: (cardId: number) => Promise<void>
  onConfirmDeleteContract: (contractId: number) => Promise<void>
  onAfterDetailMutate?: () => void | Promise<void>
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  return phone || '연락처 없음'
}

export function PremiumPaymentsOverviewBody({
  search,
  onSearchChange,
  customers,
  filteredCustomers,
  listLoading,
  listError,
  selectedCustomerId,
  selectedCustomer,
  detailState,
  mobilePickerOpen,
  onOpenMobilePicker,
  onCloseMobilePicker,
  onSelectCustomer,
  onOpenCustomerWorkspace,
  onConfirmDeleteCard,
  onConfirmDeleteContract,
  onAfterDetailMutate,
}: Props) {
  return (
    <div className="premium-payments-workspace">
      <div className="premium-payments-workspace__desktop-sidebar">
        <PremiumPaymentsCustomerSidebar
          customers={filteredCustomers}
          totalCount={customers.length}
          loading={listLoading}
          error={listError}
          search={search}
          selectedCustomerId={selectedCustomerId}
          onSearchChange={onSearchChange}
          onSelectCustomer={onSelectCustomer}
        />
      </div>

      <section className="premium-payments-workspace__detail" aria-label="선택 고객 카드 수납">
        <div className="premium-payments-workspace__mobile-picker-bar">
          <button
            type="button"
            className="premium-payments-workspace__mobile-picker-btn"
            onClick={onOpenMobilePicker}
          >
            {selectedCustomer
              ? `${selectedCustomer.customerName} · ${formatPhone(selectedCustomer.customerPhone)}`
              : '고객 선택'}
          </button>
        </div>

        {!selectedCustomer || !detailState ? (
          <div className="premium-payments-workspace__detail-empty">
            <p>
              {customers.length === 0
                ? '고객 상세에서 카드 수납 대상을 등록해 주세요.'
                : '왼쪽에서 고객을 선택해 주세요.'}
            </p>
          </div>
        ) : (
          <>
            <header className="premium-payments-workspace__detail-head">
              <div>
                <h2 className="premium-payments-workspace__detail-title">
                  {selectedCustomer.customerName}
                  <span className="premium-payments-workspace__detail-phone">
                    {' '}
                    · {formatPhone(selectedCustomer.customerPhone)}
                  </span>
                </h2>
              </div>
              <FormButton
                htmlType="button"
                variant="secondary"
                size="sm"
                onClick={() => onOpenCustomerWorkspace(selectedCustomer.customerId)}
              >
                고객 보기
              </FormButton>
            </header>
            <CustomerCardPaymentPanels
              key={selectedCustomer.customerId}
              state={detailState}
              customerName={selectedCustomer.customerName}
              actionVariant="form"
              onConfirmDeleteCard={onConfirmDeleteCard}
              onConfirmDeleteContract={onConfirmDeleteContract}
              onAfterMutate={onAfterDetailMutate}
            />
          </>
        )}
      </section>

      {mobilePickerOpen ? (
        <div className="premium-payments-workspace__drawer">
          <button
            type="button"
            className="premium-payments-workspace__drawer-backdrop"
            aria-label="닫기"
            onClick={onCloseMobilePicker}
          />
          <div className="premium-payments-workspace__drawer-panel" role="dialog" aria-modal="true">
            <PremiumPaymentsCustomerSidebar
              customers={filteredCustomers}
              totalCount={customers.length}
              loading={listLoading}
              error={listError}
              search={search}
              selectedCustomerId={selectedCustomerId}
              onSearchChange={onSearchChange}
              onSelectCustomer={(customerId) => {
                onSelectCustomer(customerId)
                onCloseMobilePicker()
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

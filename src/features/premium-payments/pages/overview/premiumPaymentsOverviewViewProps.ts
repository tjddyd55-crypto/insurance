import type { CustomerCardPaymentState } from '../../hooks/useCustomerPremiumPaymentsState'
import type { CardPaymentCustomerListItem } from '../../hooks/usePremiumPaymentsOverviewState'

export type PremiumPaymentsOverviewViewProps = {
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

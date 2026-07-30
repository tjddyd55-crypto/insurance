import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useConfirmDialog } from '../../../components/dialog'
import { useAuth } from '../../auth/AuthProvider'
import { buildCustomerWorkspacePath } from '../../customers/utils/customerRoutePaths'
import { useCustomerPremiumPaymentsState } from '../hooks/useCustomerPremiumPaymentsState'
import { usePremiumPaymentsOverviewState } from '../hooks/usePremiumPaymentsOverviewState'
import PremiumPaymentsOverviewPCView from './overview/PremiumPaymentsOverviewPCView'
import PremiumPaymentsOverviewMobileView from './overview/PremiumPaymentsOverviewMobileView'
import type { PremiumPaymentsOverviewViewProps } from './overview/premiumPaymentsOverviewViewProps'
import '../premium-payments.css'

function parseCustomerId(raw: string | null): number | null {
  if (!raw) return null
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

export default function PremiumPaymentsOverviewPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { confirm, confirmDialog } = useConfirmDialog()
  const listState = usePremiumPaymentsOverviewState(token)
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false)

  const selectedFromUrl = parseCustomerId(searchParams.get('customerId'))

  const selectedCustomerId = useMemo(() => {
    if (
      selectedFromUrl != null &&
      listState.filteredCustomers.some((c) => c.customerId === selectedFromUrl)
    ) {
      return selectedFromUrl
    }
    // URL 없거나 검색으로 제외되면 목록 첫 고객
    return listState.filteredCustomers[0]?.customerId ?? null
  }, [listState.filteredCustomers, selectedFromUrl])

  const selectedCustomer = useMemo(
    () => listState.customers.find((c) => c.customerId === selectedCustomerId) ?? null,
    [listState.customers, selectedCustomerId],
  )

  const detailState = useCustomerPremiumPaymentsState(
    selectedCustomerId ?? 0,
    token,
    selectedCustomer?.customerName,
  )

  const selectCustomer = (customerId: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('customerId', String(customerId))
    setSearchParams(next, { replace: true })
  }

  const viewProps: PremiumPaymentsOverviewViewProps = {
    search: listState.search,
    onSearchChange: listState.setSearch,
    customers: listState.customers,
    filteredCustomers: listState.filteredCustomers,
    listLoading: listState.listLoading,
    listError: listState.error,
    selectedCustomerId,
    selectedCustomer,
    detailState: selectedCustomerId ? detailState : null,
    mobilePickerOpen,
    onOpenMobilePicker: () => setMobilePickerOpen(true),
    onCloseMobilePicker: () => setMobilePickerOpen(false),
    onSelectCustomer: selectCustomer,
    onOpenCustomerWorkspace: (customerId) => {
      const query = new URLSearchParams()
      query.set('customerId', String(customerId))
      navigate(
        buildCustomerWorkspacePath({
          customerId,
          tab: 'premium-payments',
          query,
        }),
      )
    },
    onConfirmDeleteCard: async (cardId) => {
      const card = detailState.cards.find((item) => item.id === cardId)
      if (!card) return
      const ok = await confirm({
        title: '카드정보를 삭제할까요?',
        message: '등록된 카드정보가 삭제됩니다.',
        confirmLabel: '삭제',
        tone: 'danger',
      })
      if (!ok) return
      await detailState.removeCard(card)
      await listState.reload()
    },
    onConfirmDeleteContract: async (contractId) => {
      const row = detailState.contracts.find((item) => item.id === contractId)
      if (!row) return
      const ok = await confirm({
        title: '수납 대상을 삭제할까요?',
        message: `${row.insuranceCompany} 카드 수납 대상이 삭제됩니다.`,
        confirmLabel: '삭제',
        tone: 'danger',
      })
      if (!ok) return
      await detailState.removeContract(row)
      await listState.reload()
    },
    onAfterDetailMutate: () => listState.reload(),
  }

  return (
    <>
      <ResponsiveLayout<PremiumPaymentsOverviewViewProps>
        PC={PremiumPaymentsOverviewPCView}
        Mobile={PremiumPaymentsOverviewMobileView}
        viewProps={viewProps}
      />
      {confirmDialog}
    </>
  )
}

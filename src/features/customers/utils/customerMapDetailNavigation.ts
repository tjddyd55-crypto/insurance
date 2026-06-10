import type { NavigateFunction } from 'react-router-dom'
import type { CustomerMapPersistedState } from '../config/customerMap.config'
import { buildCustomerListPath, buildCustomerWorkspacePath } from './customerRoutePaths'

export type CustomerMapDetailNavigationState = {
  from: 'customer-map'
  expandCustomerId: number
  selectedCustomerId: number
  mapState: CustomerMapPersistedState
  customerName?: string
}

export function openCustomerDetailFromMap(params: {
  customerId: number
  customerName?: string
  isMobile: boolean
  mapState: CustomerMapPersistedState
  navigate: NavigateFunction
}): void {
  const { customerId, customerName, isMobile, mapState, navigate } = params
  const next = new URLSearchParams()
  next.delete('mode')
  next.set('customerId', String(customerId))

  const state: CustomerMapDetailNavigationState = {
    from: 'customer-map',
    expandCustomerId: customerId,
    selectedCustomerId: customerId,
    mapState: {
      ...mapState,
      selectedCustomerId: customerId,
    },
    customerName: customerName?.trim() || undefined,
  }

  if (isMobile) {
    navigate(buildCustomerListPath(next), {
      replace: true,
      state: customerName?.trim() ? { ...state, customerName: customerName.trim() } : state,
    })
    return
  }

  const safeTab = 'consultations'
  navigate(
    buildCustomerWorkspacePath({ customerId, tab: safeTab, query: next }),
    {
      replace: true,
      state: customerName?.trim() ? { ...state, customerName: customerName.trim() } : state,
    },
  )
}

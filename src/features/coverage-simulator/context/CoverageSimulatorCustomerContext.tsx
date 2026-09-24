import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { createMockCustomerSearchProvider } from '../customer/customerSearchProvider'
import type { CoverageSimulatorCustomerSearchProvider } from '../customer/customerSearchProvider'
import {
  customerDraftFromSelection,
  emptyCustomerDraft,
  type ConsultationCustomerDraft,
  type CoverageSimulatorCustomerListItem,
} from '../domain/customerContext'
import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'

type Value = {
  draft: ConsultationCustomerDraft
  setCustomer: (item: CoverageSimulatorCustomerListItem | null) => void
  clearCustomer: () => void
  searchProvider: CoverageSimulatorCustomerSearchProvider
}

const CoverageSimulatorCustomerContext = createContext<Value | null>(null)

function sessionKey(userKey: string): string {
  return `coverage-simulator:session-customer:v1:${userKey}`
}

function readDraft(userKey: string): ConsultationCustomerDraft {
  try {
    const raw = sessionStorage.getItem(sessionKey(userKey))
    if (!raw) return emptyCustomerDraft()
    const parsed = JSON.parse(raw) as ConsultationCustomerDraft
    if (parsed && typeof parsed === 'object') {
      return {
        customerId: parsed.customerId ?? null,
        customerNameSnapshot: parsed.customerNameSnapshot ?? null,
      }
    }
  } catch {
    /* ignore */
  }
  return emptyCustomerDraft()
}

function writeDraft(userKey: string, draft: ConsultationCustomerDraft): void {
  sessionStorage.setItem(sessionKey(userKey), JSON.stringify(draft))
}

export function CoverageSimulatorCustomerProvider({
  children,
  searchProvider,
}: {
  children: ReactNode
  searchProvider?: CoverageSimulatorCustomerSearchProvider
}) {
  const { userKey } = useCoverageSimulatorScope()
  const [draft, setDraft] = useState<ConsultationCustomerDraft>(() => readDraft(userKey))

  const provider = useMemo(
    () => searchProvider ?? createMockCustomerSearchProvider(),
    [searchProvider],
  )

  const setCustomer = useCallback(
    (item: CoverageSimulatorCustomerListItem | null) => {
      const next = customerDraftFromSelection(item)
      setDraft(next)
      writeDraft(userKey, next)
    },
    [userKey],
  )

  const clearCustomer = useCallback(() => {
    const next = emptyCustomerDraft()
    setDraft(next)
    writeDraft(userKey, next)
  }, [userKey])

  const value = useMemo(
    () => ({ draft, setCustomer, clearCustomer, searchProvider: provider }),
    [draft, setCustomer, clearCustomer, provider],
  )

  return (
    <CoverageSimulatorCustomerContext.Provider value={value}>
      {children}
    </CoverageSimulatorCustomerContext.Provider>
  )
}

export function useCoverageSimulatorCustomer(): Value {
  const ctx = useContext(CoverageSimulatorCustomerContext)
  if (!ctx) {
    throw new Error('useCoverageSimulatorCustomer requires CoverageSimulatorCustomerProvider')
  }
  return ctx
}

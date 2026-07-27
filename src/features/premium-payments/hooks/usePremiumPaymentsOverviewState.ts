import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../../lib/apiClient'
import {
  formatCardExpiry,
  listPremiumPaymentsOverview,
  type PremiumPaymentMethodRow,
} from '../api/premiumPaymentsApi'

export function usePremiumPaymentsOverviewState(token: string | null) {
  const [rows, setRows] = useState<PremiumPaymentMethodRow[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [draftQ, setDraftQ] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!token?.trim()) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const isActive =
        activeFilter === 'active' ? true : activeFilter === 'inactive' ? false : null
      const data = await listPremiumPaymentsOverview(token, {
        q,
        isActive,
        limit: 100,
        offset: 0,
      })
      setRows(Array.isArray(data.premiumPayments) ? data.premiumPayments : [])
      setTotal(Number(data.total) || 0)
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message)
      } else {
        setError(e instanceof Error ? e.message : '불러오지 못했습니다.')
      }
      setRows([])
      setTotal(0)
    } finally {
      setBusy(false)
    }
  }, [activeFilter, q, token])

  useEffect(() => {
    void load()
  }, [load])

  const submitSearch = useCallback(() => {
    setQ(draftQ.trim())
  }, [draftQ])

  return {
    rows,
    total,
    draftQ,
    setDraftQ,
    activeFilter,
    setActiveFilter,
    error,
    busy,
    formatCardExpiry,
    submitSearch,
    reload: load,
  }
}

export type PremiumPaymentsOverviewState = ReturnType<typeof usePremiumPaymentsOverviewState>

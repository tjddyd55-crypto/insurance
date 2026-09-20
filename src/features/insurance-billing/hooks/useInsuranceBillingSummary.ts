import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { fetchCheckoutSummary, type CheckoutSummary } from '../api/insuranceBillingApi'
import { isInsuranceBillingEnabledClient } from '../insuranceBillingConfig'

export function useInsuranceBillingSummary(): {
  summary: CheckoutSummary | null
  checked: boolean
  fetchFailed: boolean
} {
  const { token, user } = useAuth()
  const [summary, setSummary] = useState<CheckoutSummary | null>(null)
  const [fetchFailed, setFetchFailed] = useState(false)
  const [checked, setChecked] = useState(!isInsuranceBillingEnabledClient())

  useEffect(() => {
    if (!isInsuranceBillingEnabledClient() || user?.role !== 'USER') {
      setChecked(true)
      return
    }
    if (!token?.trim()) {
      setChecked(true)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const nextSummary = await fetchCheckoutSummary(token)
        if (!cancelled) {
          setSummary(nextSummary)
          setFetchFailed(false)
        }
      } catch {
        if (!cancelled) {
          setSummary(null)
          setFetchFailed(true)
        }
      } finally {
        if (!cancelled) {
          setChecked(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, user?.role])

  return { summary, checked, fetchFailed }
}

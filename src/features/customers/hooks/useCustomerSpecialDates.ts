import { useCallback, useEffect, useState } from 'react'
import {
  listCustomerSpecialDates,
  type CustomerSpecialDateRecord,
} from '../api/customerSpecialDatesApi'

export function useCustomerSpecialDates(params: {
  token: string | null
  customerId: number
  enabled?: boolean
}): {
  specialDates: CustomerSpecialDateRecord[]
  isLoading: boolean
  errorMessage: string | null
  reload: () => Promise<void>
} {
  const { token, customerId, enabled = true } = params
  const [specialDates, setSpecialDates] = useState<CustomerSpecialDateRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const tok = token?.trim() ?? ''
    if (!enabled || !tok || !Number.isFinite(customerId) || customerId < 1) {
      setSpecialDates([])
      setErrorMessage(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const rows = await listCustomerSpecialDates(tok, customerId)
      setSpecialDates(rows)
    } catch (e) {
      setSpecialDates([])
      setErrorMessage(e instanceof Error ? e.message : '기념일 목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [enabled, token, customerId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { specialDates, isLoading, errorMessage, reload }
}

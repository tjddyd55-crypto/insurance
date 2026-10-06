import { useCallback, useEffect, useState } from 'react'
import {
  listCustomerFireInsuranceLocations,
  type CustomerFireInsuranceLocationRecord,
} from '../api/customerFireInsuranceLocationsApi'

export function useCustomerFireInsuranceLocations(params: {
  token: string | null
  customerId: number
  enabled?: boolean
}): {
  locations: CustomerFireInsuranceLocationRecord[]
  isLoading: boolean
  errorMessage: string | null
  reload: () => Promise<void>
} {
  const { token, customerId, enabled = true } = params
  const [locations, setLocations] = useState<CustomerFireInsuranceLocationRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const tok = token?.trim() ?? ''
    if (!enabled || !tok || !Number.isFinite(customerId) || customerId < 1) {
      setLocations([])
      setErrorMessage(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const rows = await listCustomerFireInsuranceLocations(tok, customerId)
      setLocations(rows)
    } catch (e) {
      setLocations([])
      setErrorMessage(
        e instanceof Error ? e.message : '화재보험 소재지를 불러오지 못했습니다.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [enabled, token, customerId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { locations, isLoading, errorMessage, reload }
}

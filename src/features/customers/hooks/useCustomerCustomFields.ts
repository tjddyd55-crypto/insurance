import { useCallback, useEffect, useState } from 'react'
import {
  listCustomerCustomFields,
  type CustomerCustomFieldRecord,
} from '../api/customerCustomFieldsApi'

export function useCustomerCustomFields(params: {
  token: string | null
  customerId: number
  enabled?: boolean
}): {
  customFields: CustomerCustomFieldRecord[]
  isLoading: boolean
  errorMessage: string | null
  reload: () => Promise<void>
} {
  const { token, customerId, enabled = true } = params
  const [customFields, setCustomFields] = useState<CustomerCustomFieldRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const tok = token?.trim() ?? ''
    if (!enabled || !tok || !Number.isFinite(customerId) || customerId < 1) {
      setCustomFields([])
      setErrorMessage(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const rows = await listCustomerCustomFields(tok, customerId)
      setCustomFields(rows)
    } catch (e) {
      setCustomFields([])
      setErrorMessage(e instanceof Error ? e.message : '추가 정보를 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [enabled, token, customerId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { customFields, isLoading, errorMessage, reload }
}

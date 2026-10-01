import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { ApiError } from '../../../lib/apiClient'
import { buildExternalCustomerNavigateTarget } from '../utils/customerRoutePaths'
import {
  fetchCustomerRegionList,
  fetchCustomerRegionOptions,
  type CustomerRegionOptions,
  type CustomerRegionRow,
  type CustomerRegionSort,
} from '../api/customerRegionApi'

export type CustomerRegionViewProps = {
  loading: boolean
  error: string
  sido: string
  sigungu: string
  eupmyeondong: string
  query: string
  sort: CustomerRegionSort
  options: CustomerRegionOptions
  customers: CustomerRegionRow[]
  onSidoChange: (value: string) => void
  onSigunguChange: (value: string) => void
  onEupChange: (value: string) => void
  onQueryChange: (value: string) => void
  onSortChange: (value: CustomerRegionSort) => void
  onOpenCustomer: (customerId: number) => void
}

const EMPTY_OPTIONS: CustomerRegionOptions = { sido: [], sigungu: [], eupmyeondong: [] }

function readSort(raw: string | null): CustomerRegionSort {
  if (raw === 'created' || raw === 'consult' || raw === 'name') {
    return raw
  }
  return 'name'
}

export function useCustomerRegionState(): CustomerRegionViewProps {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const sido = searchParams.get('sido') ?? ''
  const sigungu = searchParams.get('sigungu') ?? ''
  const eupmyeondong = searchParams.get('eupmyeondong') ?? ''
  const query = searchParams.get('q') ?? ''
  const sort = readSort(searchParams.get('sort'))
  const [options, setOptions] = useState<CustomerRegionOptions>(EMPTY_OPTIONS)
  const [customers, setCustomers] = useState<CustomerRegionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const replaceParams = useCallback((patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(patch)) {
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
    }
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!token?.trim()) {
      setLoading(false)
      setError('로그인이 필요합니다.')
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    void Promise.all([
      fetchCustomerRegionOptions(token, { sido, sigungu }),
      fetchCustomerRegionList(token, { sido, sigungu, eupmyeondong, q: query, sort }),
    ])
      .then(([nextOptions, nextCustomers]) => {
        if (cancelled) {
          return
        }
        setOptions(nextOptions)
        setCustomers(nextCustomers)
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return
        }
        setCustomers([])
        setError(loadError instanceof ApiError ? loadError.message : '지역별 고객을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [eupmyeondong, query, sido, sigungu, sort, token])

  const onSidoChange = useCallback((value: string) => {
    replaceParams({ sido: value, sigungu: '', eupmyeondong: '' })
  }, [replaceParams])

  const onSigunguChange = useCallback((value: string) => {
    replaceParams({ sigungu: value, eupmyeondong: '' })
  }, [replaceParams])

  const onEupChange = useCallback((value: string) => {
    replaceParams({ eupmyeondong: value })
  }, [replaceParams])

  const onQueryChange = useCallback((value: string) => {
    replaceParams({ q: value })
  }, [replaceParams])

  const onSortChange = useCallback((value: CustomerRegionSort) => {
    replaceParams({ sort: value === 'name' ? '' : value })
  }, [replaceParams])

  const onOpenCustomer = useCallback((customerId: number) => {
    const isMobile = window.matchMedia('(max-width: 768px) and (pointer: coarse)').matches
    navigate(buildExternalCustomerNavigateTarget({ customerId, isMobile }))
  }, [navigate])

  return useMemo(() => ({
    loading,
    error,
    sido,
    sigungu,
    eupmyeondong,
    query,
    sort,
    options,
    customers,
    onSidoChange,
    onSigunguChange,
    onEupChange,
    onQueryChange,
    onSortChange,
    onOpenCustomer,
  }), [
    customers,
    error,
    eupmyeondong,
    loading,
    onEupChange,
    onOpenCustomer,
    onQueryChange,
    onSidoChange,
    onSigunguChange,
    onSortChange,
    options,
    query,
    sido,
    sigungu,
    sort,
  ])
}

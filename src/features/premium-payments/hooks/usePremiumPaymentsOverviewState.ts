import { useCallback, useEffect, useMemo, useState } from 'react'
import { listCardPaymentContractsOverview, type CardPaymentContractRow } from '../api/premiumPaymentsApi'
import {
  buildInsurerGroupOptions,
  filterInsurerOptions,
  groupContractsByCustomerForInsurer,
  type InsurerGroupKey,
  type InsurerGroupOption,
} from '../domain/insurerGrouping'

export type CardPaymentOverviewViewMode = 'customer' | 'insurer'

function currentMonthInputValue(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  return `${y}-${m}`
}

export type CardPaymentCustomerListItem = {
  customerId: number
  customerName: string
  customerPhone: string
  ownerDisplayName: string
  targetCount: number
}

export function usePremiumPaymentsOverviewState(token: string | null) {
  const [month] = useState(currentMonthInputValue)
  const [search, setSearch] = useState('')
  const [insurerSearch, setInsurerSearch] = useState('')
  const [customers, setCustomers] = useState<CardPaymentCustomerListItem[]>([])
  const [rows, setRows] = useState<CardPaymentContractRow[]>([])
  const [viewMode, setViewMode] = useState<CardPaymentOverviewViewMode>('customer')
  const [selectedInsurerKey, setSelectedInsurerKey] = useState<InsurerGroupKey | null>(null)
  const [listLoading, setListLoading] = useState(false)
  const [error, setError] = useState('')

  const loadCustomers = useCallback(async () => {
    if (!token?.trim()) {
      return
    }
    setListLoading(true)
    setError('')
    try {
      // 단일 요청(최대 1000건)으로 고객별·보험사별 그룹을 모두 프론트에서 구성 (N+1 없음)
      const data = await listCardPaymentContractsOverview(token, { month, limit: 1000 })
      setRows(data.contracts)
      const map = new Map<number, CardPaymentCustomerListItem>()
      for (const row of data.contracts) {
        const existing = map.get(row.customerId)
        if (existing) {
          existing.targetCount += 1
          continue
        }
        map.set(row.customerId, {
          customerId: row.customerId,
          customerName: row.customerName ?? `고객 #${row.customerId}`,
          customerPhone: row.customerPhone ?? '',
          ownerDisplayName: row.ownerDisplayName ?? '',
          targetCount: 1,
        })
      }
      const next = [...map.values()].sort((a, b) =>
        a.customerName.localeCompare(b.customerName, 'ko'),
      )
      setCustomers(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : '고객 목록을 불러오지 못했습니다.')
      setCustomers([])
      setRows([])
    } finally {
      setListLoading(false)
    }
  }, [month, token])

  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((item) => {
      const name = item.customerName.toLowerCase()
      const phone = item.customerPhone.replace(/\D/g, '')
      const qDigits = q.replace(/\D/g, '')
      return name.includes(q) || (qDigits.length > 0 && phone.includes(qDigits))
    })
  }, [customers, search])

  // 카드 수납 데이터가 있는 보험사만 (손해→생명→기타→미지정)
  const insurerOptions = useMemo<InsurerGroupOption[]>(() => buildInsurerGroupOptions(rows), [rows])

  const filteredInsurerOptions = useMemo(
    () => filterInsurerOptions(insurerOptions, insurerSearch),
    [insurerOptions, insurerSearch],
  )

  /** 선택 유지, 없으면(검색 제외 포함) 목록 첫 보험사 자동 선택 */
  const effectiveInsurerKey = useMemo<InsurerGroupKey | null>(() => {
    if (selectedInsurerKey && filteredInsurerOptions.some((o) => o.key === selectedInsurerKey)) return selectedInsurerKey
    return filteredInsurerOptions[0]?.key ?? null
  }, [filteredInsurerOptions, selectedInsurerKey])

  const selectedInsurer = useMemo(
    () => insurerOptions.find((o) => o.key === effectiveInsurerKey) ?? null,
    [effectiveInsurerKey, insurerOptions],
  )

  // 이미 받은 rows 를 클라이언트에서 그룹핑 — 보험사 클릭 시 추가 API 호출 없음
  const insurerCustomerGroups = useMemo(
    () => groupContractsByCustomerForInsurer(rows, effectiveInsurerKey),
    [effectiveInsurerKey, rows],
  )

  /** 고객별 보기 상세 선택 기준 */
  const visibleCustomers = filteredCustomers

  return {
    viewMode,
    setViewMode,
    insurerOptions,
    selectedInsurerKey: effectiveInsurerKey,
    setSelectedInsurerKey,
    filteredInsurerOptions,
    selectedInsurer,
    insurerSearch,
    setInsurerSearch,
    insurerCustomerGroups,
    visibleCustomers,
    search,
    setSearch,
    customers,
    filteredCustomers,
    listLoading,
    error,
    reload: loadCustomers,
  }
}

export type PremiumPaymentsOverviewState = ReturnType<typeof usePremiumPaymentsOverviewState>

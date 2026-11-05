import { useCallback, useEffect, useMemo, useState } from 'react'
import { listCardPaymentContractsOverview, type CardPaymentContractRow } from '../api/premiumPaymentsApi'
import {
  INSURER_GROUP_OTHER,
  INSURER_GROUP_UNASSIGNED,
  buildInsurerGroupOptions,
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

  const insurerOptions = useMemo<InsurerGroupOption[]>(() => {
    const opts = buildInsurerGroupOptions(rows)
    // 기타/미지정은 건수 0이어도 선택지에 항상 노출
    for (const [key, label] of [
      [INSURER_GROUP_OTHER, '기타'],
      [INSURER_GROUP_UNASSIGNED, '미지정'],
    ] as const) {
      if (!opts.some((o) => o.key === key)) opts.push({ key, label, category: null, count: 0 })
    }
    return opts
  }, [rows])

  const effectiveInsurerKey = useMemo<InsurerGroupKey | null>(() => {
    if (selectedInsurerKey && insurerOptions.some((o) => o.key === selectedInsurerKey)) return selectedInsurerKey
    return insurerOptions.find((o) => o.count > 0)?.key ?? insurerOptions[0]?.key ?? null
  }, [insurerOptions, selectedInsurerKey])

  const insurerCustomerGroups = useMemo(
    () => groupContractsByCustomerForInsurer(rows, effectiveInsurerKey, search),
    [effectiveInsurerKey, rows, search],
  )

  /** 현재 모드에서 사이드바에 보이는 고객 (상세 선택 기준) */
  const visibleCustomers = useMemo<CardPaymentCustomerListItem[]>(() => {
    if (viewMode === 'customer') return filteredCustomers
    const byId = new Map(customers.map((c) => [c.customerId, c]))
    return insurerCustomerGroups.map(
      (g) =>
        byId.get(g.customerId) ?? {
          customerId: g.customerId,
          customerName: g.customerName,
          customerPhone: g.customerPhone,
          ownerDisplayName: '',
          targetCount: g.contracts.length,
        },
    )
  }, [customers, filteredCustomers, insurerCustomerGroups, viewMode])

  return {
    viewMode,
    setViewMode,
    insurerOptions,
    selectedInsurerKey: effectiveInsurerKey,
    setSelectedInsurerKey,
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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { listCardPaymentContractsOverview } from '../api/premiumPaymentsApi'

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
  const [listLoading, setListLoading] = useState(false)
  const [error, setError] = useState('')

  const loadCustomers = useCallback(async () => {
    if (!token?.trim()) {
      return
    }
    setListLoading(true)
    setError('')
    try {
      const data = await listCardPaymentContractsOverview(token, { month })
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

  return {
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

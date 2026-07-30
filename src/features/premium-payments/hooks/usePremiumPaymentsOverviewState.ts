import { useCallback, useEffect, useMemo, useState } from 'react'
import { copyTextToClipboard } from '../../../lib/clipboard'
import {
  completeCardPaymentContract,
  listCardPaymentContractsOverview,
  reopenCardPaymentContract,
  type CardPaymentContractRow,
  type OverviewSummary,
} from '../api/premiumPaymentsApi'

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

export type CustomerContractGroup = {
  customerId: number
  customerName: string
  customerPhone: string
  ownerDisplayName: string
  contracts: CardPaymentContractRow[]
}

export function usePremiumPaymentsOverviewState(token: string | null) {
  const [month, setMonth] = useState(currentMonthInputValue)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [paymentDay, setPaymentDay] = useState('')
  const [insuranceCompany, setInsuranceCompany] = useState('')
  const [contracts, setContracts] = useState<CardPaymentContractRow[]>([])
  const [summary, setSummary] = useState<OverviewSummary>({
    total: 0,
    pending: 0,
    completed: 0,
    paused: 0,
  })
  const [targetMonth, setTargetMonth] = useState(month)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copyHint, setCopyHint] = useState('')

  const loadAll = useCallback(async () => {
    if (!token?.trim()) {
      return
    }
    setError('')
    try {
      const data = await listCardPaymentContractsOverview(token, {
        month,
        status: status || undefined,
        search: search || undefined,
        paymentDay: paymentDay || undefined,
        insuranceCompany: insuranceCompany || undefined,
      })
      setContracts(data.contracts)
      setSummary(data.summary)
      setTargetMonth(data.targetMonth)
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    }
  }, [insuranceCompany, month, paymentDay, search, status, token])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const groups = useMemo((): CustomerContractGroup[] => {
    const map = new Map<number, CustomerContractGroup>()
    for (const row of contracts) {
      const existing = map.get(row.customerId)
      if (existing) {
        existing.contracts.push(row)
        continue
      }
      map.set(row.customerId, {
        customerId: row.customerId,
        customerName: row.customerName ?? `고객 #${row.customerId}`,
        customerPhone: row.customerPhone ?? '',
        ownerDisplayName: row.ownerDisplayName ?? '',
        contracts: [row],
      })
    }
    return [...map.values()]
  }, [contracts])

  const showCopyHint = useCallback((message: string) => {
    setCopyHint(message)
    window.setTimeout(() => setCopyHint(''), 1800)
  }, [])

  const copyPolicyNumber = useCallback(
    async (value: string | null | undefined) => {
      if (!value?.trim()) return
      if (await copyTextToClipboard(value.trim())) {
        showCopyHint('증권번호를 복사했습니다.')
      }
    },
    [showCopyHint],
  )

  const copyCardNumber = useCallback(
    async (digits: string | null | undefined) => {
      const normalized = String(digits ?? '').replace(/\D/g, '')
      if (!normalized) return
      if (await copyTextToClipboard(normalized)) {
        showCopyHint('카드번호를 복사했습니다.')
      }
    },
    [showCopyHint],
  )

  const copyCardExpiry = useCallback(
    async (expiry: string | null | undefined) => {
      if (!expiry?.trim()) return
      if (await copyTextToClipboard(expiry.trim())) {
        showCopyHint('유효기간을 복사했습니다.')
      }
    },
    [showCopyHint],
  )

  const patchContractLocal = useCallback((next: CardPaymentContractRow) => {
    setContracts((prev) => {
      const updated = prev.map((row) => (row.id === next.id ? next : row))
      return updated
    })
    setSummary((prev) => {
      const all = contracts.map((row) => (row.id === next.id ? next : row))
      return {
        total: all.length,
        pending: all.filter((r) => r.monthStatus === 'PENDING').length,
        completed: all.filter((r) => r.monthStatus === 'COMPLETED').length,
        paused: all.filter((r) => r.monthStatus === 'PAUSED').length,
      }
    })
  }, [contracts])

  const markComplete = useCallback(
    async (row: CardPaymentContractRow) => {
      if (!token?.trim() || busy) return
      setBusy(true)
      setError('')
      try {
        const result = await completeCardPaymentContract(token, row.customerId, row.id, targetMonth)
        setContracts((prev) => {
          const updated = prev.map((item) => (item.id === row.id ? result.contract : item))
          setSummary({
            total: updated.length,
            pending: updated.filter((r) => r.monthStatus === 'PENDING').length,
            completed: updated.filter((r) => r.monthStatus === 'COMPLETED').length,
            paused: updated.filter((r) => r.monthStatus === 'PAUSED').length,
          })
          return updated
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : '완료 처리하지 못했습니다.')
      } finally {
        setBusy(false)
      }
    },
    [busy, targetMonth, token],
  )

  const markReopen = useCallback(
    async (row: CardPaymentContractRow) => {
      if (!token?.trim() || busy) return
      setBusy(true)
      setError('')
      try {
        const result = await reopenCardPaymentContract(token, row.customerId, row.id, targetMonth)
        setContracts((prev) => {
          const updated = prev.map((item) => (item.id === row.id ? result.contract : item))
          setSummary({
            total: updated.length,
            pending: updated.filter((r) => r.monthStatus === 'PENDING').length,
            completed: updated.filter((r) => r.monthStatus === 'COMPLETED').length,
            paused: updated.filter((r) => r.monthStatus === 'PAUSED').length,
          })
          return updated
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : '상태를 변경하지 못했습니다.')
      } finally {
        setBusy(false)
      }
    },
    [busy, targetMonth, token],
  )

  return {
    month,
    setMonth,
    status,
    setStatus,
    search,
    setSearch,
    paymentDay,
    setPaymentDay,
    insuranceCompany,
    setInsuranceCompany,
    targetMonth,
    summary,
    groups,
    contracts,
    error,
    busy,
    copyHint,
    copyPolicyNumber,
    copyCardNumber,
    copyCardExpiry,
    markComplete,
    markReopen,
    reload: loadAll,
    patchContractLocal,
  }
}

export type PremiumPaymentsOverviewState = ReturnType<typeof usePremiumPaymentsOverviewState>

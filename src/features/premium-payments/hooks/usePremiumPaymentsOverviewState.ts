import { useCallback, useEffect, useMemo, useState } from 'react'
import { copyTextToClipboard } from '../../../lib/clipboard'
import {
  deleteCardPaymentContract,
  listCardPaymentContractsOverview,
  type CardPaymentContractRow,
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
  const [month] = useState(currentMonthInputValue)
  const [search, setSearch] = useState('')
  const [paymentDay, setPaymentDay] = useState('')
  const [insuranceCompany, setInsuranceCompany] = useState('')
  const [contracts, setContracts] = useState<CardPaymentContractRow[]>([])
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
        search: search || undefined,
        paymentDay: paymentDay || undefined,
        insuranceCompany: insuranceCompany || undefined,
      })
      setContracts(data.contracts)
      setTargetMonth(data.targetMonth)
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    }
  }, [insuranceCompany, month, paymentDay, search, token])

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

  const removeContract = useCallback(
    async (row: CardPaymentContractRow) => {
      if (!token?.trim() || busy) return
      setBusy(true)
      setError('')
      try {
        await deleteCardPaymentContract(token, row.customerId, row.id)
        setContracts((prev) => prev.filter((item) => item.id !== row.id))
      } catch (e) {
        setError(e instanceof Error ? e.message : '삭제하지 못했습니다.')
      } finally {
        setBusy(false)
      }
    },
    [busy, token],
  )

  return {
    search,
    setSearch,
    paymentDay,
    setPaymentDay,
    insuranceCompany,
    setInsuranceCompany,
    targetMonth,
    totalCount: contracts.length,
    groups,
    contracts,
    error,
    busy,
    copyHint,
    copyPolicyNumber,
    copyCardNumber,
    copyCardExpiry,
    removeContract,
    reload: loadAll,
  }
}

export type PremiumPaymentsOverviewState = ReturnType<typeof usePremiumPaymentsOverviewState>

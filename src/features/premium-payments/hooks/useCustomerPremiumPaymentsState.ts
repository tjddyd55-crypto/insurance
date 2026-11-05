import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../../lib/apiClient'
import { copyTextToClipboard } from '../../../lib/clipboard'
import {
  createCardPaymentContract,
  createPaymentCard,
  deleteCardPaymentContract,
  deletePaymentCard,
  listCardPaymentContracts,
  listPaymentCards,
  updateCardPaymentContract,
  updatePaymentCard,
  type CardPaymentContractRow,
  type ContractWritePayload,
  type PaymentCardRow,
  type PaymentCardWritePayload,
} from '../api/premiumPaymentsApi'
import { fetchActiveInsurerSites, type InsurerSite } from '../../insurer-sites/api/insurerSitesApi'

export type CardFormState = {
  label: string
  cardOwnerName: string
  cardNumber: string
  cardExpiryMonth: string
  cardExpiryYear: string
}

/** 보험 구분: 손해/생명(카탈로그) 또는 기타(직접 입력) */
export type ContractInsurerCategory = '' | 'NON_LIFE' | 'LIFE' | 'OTHER'

export type ContractFormState = {
  insurerCategory: ContractInsurerCategory
  /** insurer_sites.id 문자열 ('' = 미선택) */
  insuranceCompanyId: string
  /** 기타 선택 시 직접 입력 텍스트 (기존 미매칭 값 포함) */
  insuranceCompany: string
  policyNumber: string
  productName: string
  premiumAmount: string
  paymentDay: string
  paymentCardId: string
  memo: string
  /** UI 미노출 — 수정 시 기존 값 유지용 */
  status: 'PENDING' | 'PAUSED'
}

const emptyCardForm = (ownerName = ''): CardFormState => ({
  label: '',
  cardOwnerName: ownerName,
  cardNumber: '',
  cardExpiryMonth: '',
  cardExpiryYear: '',
})

const emptyContractForm = (): ContractFormState => ({
  insurerCategory: '',
  insuranceCompanyId: '',
  insuranceCompany: '',
  policyNumber: '',
  productName: '',
  premiumAmount: '',
  paymentDay: '',
  paymentCardId: '',
  memo: '',
  status: 'PENDING',
})

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

export function useCustomerPremiumPaymentsState(
  customerId: number,
  token: string | null,
  customerName = '',
) {
  const validId = Number.isInteger(customerId) && customerId > 0
  const [cards, setCards] = useState<PaymentCardRow[]>([])
  const [contracts, setContracts] = useState<CardPaymentContractRow[]>([])
  const [targetMonth, setTargetMonth] = useState(currentMonthInputValue)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [copyHint, setCopyHint] = useState('')

  const [cardFormOpen, setCardFormOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<PaymentCardRow | null>(null)
  const [cardForm, setCardForm] = useState<CardFormState>(emptyCardForm(customerName))

  const [contractFormOpen, setContractFormOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<CardPaymentContractRow | null>(null)
  const [contractForm, setContractForm] = useState<ContractFormState>(emptyContractForm())
  const loadSeqRef = useRef(0)
  const [insurerSites, setInsurerSites] = useState<InsurerSite[]>([])

  useEffect(() => {
    if (!token?.trim()) return
    let cancelled = false
    fetchActiveInsurerSites(token)
      .then((res) => {
        if (!cancelled) setInsurerSites((res.items ?? []).filter((s) => s.isActive))
      })
      .catch(() => {
        if (!cancelled) setInsurerSites([])
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const loadAll = useCallback(async () => {
    if (!token?.trim() || !validId) {
      return
    }
    const seq = ++loadSeqRef.current
    setError('')
    setNotFound(false)
    try {
      const [cardList, contractList] = await Promise.all([
        listPaymentCards(token, customerId),
        listCardPaymentContracts(token, customerId, targetMonth),
      ])
      if (seq !== loadSeqRef.current) {
        return
      }
      setCards(cardList)
      setContracts(contractList.contracts)
      setTargetMonth(contractList.targetMonth)
    } catch (e) {
      if (seq !== loadSeqRef.current) {
        return
      }
      if (e instanceof ApiError && e.status === 404) {
        setNotFound(true)
        setCards([])
        setContracts([])
        return
      }
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.')
    }
  }, [customerId, targetMonth, token, validId])

  useEffect(() => {
    loadSeqRef.current += 1
    setCards([])
    setContracts([])
    setError('')
    setNotFound(false)
    setCopyHint('')
    setCardFormOpen(false)
    setEditingCard(null)
    setContractFormOpen(false)
    setEditingContract(null)
  }, [customerId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const showCopyHint = useCallback((message: string) => {
    setCopyHint(message)
    window.setTimeout(() => setCopyHint(''), 1800)
  }, [])

  const copyPolicyNumber = useCallback(
    async (value: string | null | undefined) => {
      if (!value?.trim()) {
        return
      }
      const ok = await copyTextToClipboard(value.trim())
      if (ok) {
        showCopyHint('증권번호를 복사했습니다.')
      }
    },
    [showCopyHint],
  )

  const copyCardNumber = useCallback(
    async (digits: string | null | undefined) => {
      const normalized = String(digits ?? '').replace(/\D/g, '')
      if (!normalized) {
        return
      }
      const ok = await copyTextToClipboard(normalized)
      if (ok) {
        showCopyHint('카드번호를 복사했습니다.')
      }
    },
    [showCopyHint],
  )

  const copyCardExpiry = useCallback(
    async (expiry: string | null | undefined) => {
      if (!expiry?.trim()) {
        return
      }
      const ok = await copyTextToClipboard(expiry.trim())
      if (ok) {
        showCopyHint('유효기간을 복사했습니다.')
      }
    },
    [showCopyHint],
  )

  const openCreateCard = useCallback(() => {
    setEditingCard(null)
    setCardForm(emptyCardForm(customerName))
    setCardFormOpen(true)
    setError('')
  }, [customerName])

  const openEditCard = useCallback((card: PaymentCardRow) => {
    setEditingCard(card)
    setCardForm({
      label: card.label,
      cardOwnerName: card.cardOwnerName,
      cardNumber: '',
      cardExpiryMonth: String(card.cardExpiryMonth).padStart(2, '0'),
      cardExpiryYear: String(card.cardExpiryYear),
    })
    setCardFormOpen(true)
    setError('')
  }, [])

  const closeCardForm = useCallback(() => {
    setCardFormOpen(false)
    setEditingCard(null)
  }, [])

  const submitCardForm = useCallback(
    async (event: FormEvent): Promise<boolean> => {
      event.preventDefault()
      if (!token?.trim() || !validId || busy) {
        return false
      }
      const payload: PaymentCardWritePayload = {
        label: cardForm.label.trim(),
        cardOwnerName: cardForm.cardOwnerName.trim(),
        cardExpiryMonth: Number(cardForm.cardExpiryMonth),
        cardExpiryYear: Number(cardForm.cardExpiryYear),
      }
      if (cardForm.cardNumber.trim() || !editingCard) {
        payload.cardNumber = cardForm.cardNumber.trim()
      }
      setBusy(true)
      setError('')
      try {
        if (editingCard) {
          await updatePaymentCard(token, customerId, editingCard.id, payload)
        } else {
          await createPaymentCard(token, customerId, payload)
        }
        closeCardForm()
        await loadAll()
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : '저장하지 못했습니다.')
        return false
      } finally {
        setBusy(false)
      }
    },
    [busy, cardForm, closeCardForm, customerId, editingCard, loadAll, token, validId],
  )

  const removeCard = useCallback(
    async (card: PaymentCardRow) => {
      if (!token?.trim() || busy) {
        return
      }
      setBusy(true)
      setError('')
      try {
        await deletePaymentCard(token, customerId, card.id)
        await loadAll()
      } catch (e) {
        setError(e instanceof Error ? e.message : '삭제하지 못했습니다.')
      } finally {
        setBusy(false)
      }
    },
    [busy, customerId, loadAll, token],
  )

  const openCreateContract = useCallback(() => {
    setEditingContract(null)
    setContractForm(emptyContractForm())
    setContractFormOpen(true)
    setError('')
  }, [])

  const openEditContract = useCallback((row: CardPaymentContractRow) => {
    setEditingContract(row)
    const linked = row.insuranceCompanyId != null && row.insuranceCompanyId > 0
    setContractForm({
      insurerCategory: linked
        ? row.insurerCategory === 'LIFE'
          ? 'LIFE'
          : 'NON_LIFE'
        : row.insuranceCompany?.trim()
          ? 'OTHER'
          : '',
      insuranceCompanyId: linked ? String(row.insuranceCompanyId) : '',
      insuranceCompany: linked ? '' : row.insuranceCompany,
      policyNumber: row.policyNumber ?? '',
      productName: row.productName ?? '',
      premiumAmount: row.premiumAmount == null ? '' : String(row.premiumAmount),
      paymentDay: row.paymentDay == null ? '' : String(row.paymentDay),
      paymentCardId: row.paymentCardId == null ? '' : String(row.paymentCardId),
      memo: row.memo ?? '',
      status: row.status,
    })
    setContractFormOpen(true)
    setError('')
  }, [])

  const closeContractForm = useCallback(() => {
    setContractFormOpen(false)
    setEditingContract(null)
  }, [])

  const submitContractForm = useCallback(
    async (event: FormEvent): Promise<boolean> => {
      event.preventDefault()
      if (!token?.trim() || !validId || busy) {
        return false
      }
      const isOther = contractForm.insurerCategory === 'OTHER'
      const siteId = isOther ? null : Number(contractForm.insuranceCompanyId)
      const site = siteId ? insurerSites.find((s) => s.id === siteId) : undefined
      if (!isOther && !siteId) {
        setError('보험사를 선택해 주세요.')
        return false
      }
      if (isOther && !contractForm.insuranceCompany.trim()) {
        setError('보험회사명을 입력해 주세요.')
        return false
      }
      const payload: ContractWritePayload = {
        insuranceCompanyId: isOther ? null : siteId,
        insuranceCompany: isOther ? contractForm.insuranceCompany.trim() : (site?.name ?? ''),
        policyNumber: contractForm.policyNumber.trim() || null,
        productName: contractForm.productName.trim() || null,
        memo: contractForm.memo.trim(),
        status: contractForm.status,
        paymentCardId: contractForm.paymentCardId ? Number(contractForm.paymentCardId) : null,
        paymentDay: contractForm.paymentDay ? Number(contractForm.paymentDay) : null,
        premiumAmount: contractForm.premiumAmount
          ? Number(contractForm.premiumAmount.replace(/[^\d]/g, ''))
          : null,
      }
      setBusy(true)
      setError('')
      try {
        if (editingContract) {
          await updateCardPaymentContract(token, customerId, editingContract.id, payload)
        } else {
          await createCardPaymentContract(token, customerId, payload)
        }
        closeContractForm()
        await loadAll()
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : '저장하지 못했습니다.')
        return false
      } finally {
        setBusy(false)
      }
    },
    [busy, closeContractForm, contractForm, customerId, editingContract, insurerSites, loadAll, token, validId],
  )

  const removeContract = useCallback(
    async (row: CardPaymentContractRow) => {
      if (!token?.trim() || busy) {
        return
      }
      setBusy(true)
      setError('')
      try {
        await deleteCardPaymentContract(token, customerId, row.id)
        await loadAll()
      } catch (e) {
        setError(e instanceof Error ? e.message : '삭제하지 못했습니다.')
      } finally {
        setBusy(false)
      }
    },
    [busy, customerId, loadAll, token],
  )

  const cardOptions = useMemo(
    () =>
      cards.map((card) => ({
        value: String(card.id),
        label: [card.label?.trim(), card.cardOwnerName?.trim(), `끝 ${card.cardNumberLast4}`]
          .filter(Boolean)
          .join(' · '),
      })),
    [cards],
  )

  return {
    cards,
    contracts,
    targetMonth,
    error,
    busy,
    notFound,
    copyHint,
    cardFormOpen,
    editingCard,
    cardForm,
    setCardForm,
    openCreateCard,
    openEditCard,
    closeCardForm,
    submitCardForm,
    removeCard,
    contractFormOpen,
    editingContract,
    contractForm,
    setContractForm,
    openCreateContract,
    openEditContract,
    closeContractForm,
    submitContractForm,
    removeContract,
    copyPolicyNumber,
    copyCardNumber,
    copyCardExpiry,
    cardOptions,
    insurerSites,
    reload: loadAll,
  }
}

export type CustomerCardPaymentState = ReturnType<typeof useCustomerPremiumPaymentsState>

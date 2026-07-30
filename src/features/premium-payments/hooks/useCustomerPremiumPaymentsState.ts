import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../../lib/apiClient'
import { copyTextToClipboard } from '../../../lib/clipboard'
import {
  completeCardPaymentContract,
  createCardPaymentContract,
  createPaymentCard,
  deleteCardPaymentContract,
  deletePaymentCard,
  listCardPaymentContracts,
  listPaymentCards,
  reopenCardPaymentContract,
  updateCardPaymentContract,
  updatePaymentCard,
  type CardPaymentContractRow,
  type ContractWritePayload,
  type PaymentCardRow,
  type PaymentCardWritePayload,
} from '../api/premiumPaymentsApi'

export type CardFormState = {
  label: string
  cardOwnerName: string
  cardNumber: string
  cardExpiryMonth: string
  cardExpiryYear: string
}

export type ContractFormState = {
  insuranceCompany: string
  policyNumber: string
  productName: string
  premiumAmount: string
  paymentDay: string
  paymentCardId: string
  memo: string
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

  const loadAll = useCallback(async () => {
    if (!token?.trim() || !validId) {
      return
    }
    setError('')
    setNotFound(false)
    try {
      const [cardList, contractList] = await Promise.all([
        listPaymentCards(token, customerId),
        listCardPaymentContracts(token, customerId, targetMonth),
      ])
      setCards(cardList)
      setContracts(contractList.contracts)
      setTargetMonth(contractList.targetMonth)
    } catch (e) {
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
    setCards([])
    setContracts([])
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
      cardExpiryMonth: String(card.cardExpiryMonth),
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
    async (event: FormEvent) => {
      event.preventDefault()
      if (!token?.trim() || !validId || busy) {
        return
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
      } catch (e) {
        setError(e instanceof Error ? e.message : '저장하지 못했습니다.')
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
    setContractForm({
      insuranceCompany: row.insuranceCompany,
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
    async (event: FormEvent) => {
      event.preventDefault()
      if (!token?.trim() || !validId || busy) {
        return
      }
      const payload: ContractWritePayload = {
        insuranceCompany: contractForm.insuranceCompany.trim(),
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
      } catch (e) {
        setError(e instanceof Error ? e.message : '저장하지 못했습니다.')
      } finally {
        setBusy(false)
      }
    },
    [busy, closeContractForm, contractForm, customerId, editingContract, loadAll, token, validId],
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

  const markComplete = useCallback(
    async (row: CardPaymentContractRow) => {
      if (!token?.trim() || busy) {
        return
      }
      setBusy(true)
      setError('')
      try {
        const result = await completeCardPaymentContract(token, customerId, row.id, targetMonth)
        setContracts((prev) => prev.map((item) => (item.id === row.id ? result.contract : item)))
      } catch (e) {
        setError(e instanceof Error ? e.message : '완료 처리하지 못했습니다.')
      } finally {
        setBusy(false)
      }
    },
    [busy, customerId, targetMonth, token],
  )

  const markReopen = useCallback(
    async (row: CardPaymentContractRow) => {
      if (!token?.trim() || busy) {
        return
      }
      setBusy(true)
      setError('')
      try {
        const result = await reopenCardPaymentContract(token, customerId, row.id, targetMonth)
        setContracts((prev) => prev.map((item) => (item.id === row.id ? result.contract : item)))
      } catch (e) {
        setError(e instanceof Error ? e.message : '상태를 변경하지 못했습니다.')
      } finally {
        setBusy(false)
      }
    },
    [busy, customerId, targetMonth, token],
  )

  const cardOptions = useMemo(
    () =>
      cards.map((card) => ({
        value: String(card.id),
        label: `${card.label || '카드'} · ${card.cardOwnerName} · 끝 ${card.cardNumberLast4}`,
      })),
    [cards],
  )

  return {
    cards,
    contracts,
    targetMonth,
    setTargetMonth,
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
    markComplete,
    markReopen,
    copyPolicyNumber,
    copyCardNumber,
    copyCardExpiry,
    cardOptions,
    reload: loadAll,
  }
}

export type CustomerCardPaymentState = ReturnType<typeof useCustomerPremiumPaymentsState>

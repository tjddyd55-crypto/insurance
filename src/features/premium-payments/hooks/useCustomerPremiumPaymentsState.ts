import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../../lib/apiClient'
import { copyTextToClipboard } from '../../../lib/clipboard'
import {
  createCustomerPremiumPayment,
  disableCustomerPremiumPayment,
  enableCustomerPremiumPayment,
  formatCardExpiry,
  listCustomerPremiumPayments,
  reauthenticatePremiumPaymentCard,
  revealPremiumPaymentCardNumber,
  updateCustomerPremiumPayment,
  type PremiumPaymentMethodRow,
  type PremiumPaymentWritePayload,
} from '../api/premiumPaymentsApi'

export type PremiumPaymentFormState = {
  insuranceCompany: string
  policyNumber: string
  cardholderName: string
  cardNumber: string
  cardExpiryMonth: string
  cardExpiryYear: string
  memo: string
}

const emptyForm = (): PremiumPaymentFormState => ({
  insuranceCompany: '',
  policyNumber: '',
  cardholderName: '',
  cardNumber: '',
  cardExpiryMonth: '',
  cardExpiryYear: '',
  memo: '',
})

function toPayload(form: PremiumPaymentFormState, includeCard: boolean): PremiumPaymentWritePayload {
  const payload: PremiumPaymentWritePayload = {
    insuranceCompany: form.insuranceCompany.trim(),
    policyNumber: form.policyNumber.trim(),
    cardholderName: form.cardholderName.trim(),
    cardExpiryMonth: Number(form.cardExpiryMonth),
    cardExpiryYear: Number(form.cardExpiryYear),
    memo: form.memo.trim(),
  }
  if (includeCard && form.cardNumber.trim()) {
    payload.cardNumber = form.cardNumber.trim()
  }
  return payload
}

export function useCustomerPremiumPaymentsState(customerId: number, token: string | null) {
  const validId = Number.isInteger(customerId) && customerId > 0
  const [rows, setRows] = useState<PremiumPaymentMethodRow[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PremiumPaymentMethodRow | null>(null)
  const [form, setForm] = useState<PremiumPaymentFormState>(emptyForm)
  const [copyHint, setCopyHint] = useState('')
  const [revealOpen, setRevealOpen] = useState(false)
  const [revealTarget, setRevealTarget] = useState<PremiumPaymentMethodRow | null>(null)
  const [revealPassword, setRevealPassword] = useState('')
  const [revealedCardNumber, setRevealedCardNumber] = useState('')
  const [revealError, setRevealError] = useState('')

  const loadAll = useCallback(async () => {
    if (!token?.trim() || !validId) {
      return
    }
    setError('')
    setNotFound(false)
    try {
      const list = await listCustomerPremiumPayments(token, customerId)
      setRows(list)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setNotFound(true)
        setRows([])
        return
      }
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.')
    }
  }, [customerId, token, validId])

  useEffect(() => {
    setRows([])
  }, [customerId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const openCreate = useCallback(() => {
    setEditing(null)
    setForm(emptyForm())
    setFormOpen(true)
    setError('')
  }, [])

  const openEdit = useCallback((row: PremiumPaymentMethodRow) => {
    setEditing(row)
    setForm({
      insuranceCompany: row.insuranceCompany,
      policyNumber: row.policyNumber,
      cardholderName: row.cardholderName,
      cardNumber: '',
      cardExpiryMonth: String(row.cardExpiryMonth),
      cardExpiryYear: String(row.cardExpiryYear),
      memo: row.memo,
    })
    setFormOpen(true)
    setError('')
  }, [])

  const closeForm = useCallback(() => {
    if (busy) {
      return
    }
    setFormOpen(false)
    setEditing(null)
  }, [busy])

  const submitForm = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      if (!token?.trim() || !validId || busy) {
        return
      }
      setBusy(true)
      setError('')
      try {
        if (editing) {
          await updateCustomerPremiumPayment(
            token,
            customerId,
            editing.id,
            toPayload(form, Boolean(form.cardNumber.trim())),
          )
        } else {
          if (!form.cardNumber.trim()) {
            setError('카드번호를 입력해 주세요.')
            setBusy(false)
            return
          }
          await createCustomerPremiumPayment(token, customerId, toPayload(form, true))
        }
        setFormOpen(false)
        setEditing(null)
        await loadAll()
      } catch (e) {
        setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
      } finally {
        setBusy(false)
      }
    },
    [busy, customerId, editing, form, loadAll, token, validId],
  )

  const toggleActive = useCallback(
    async (row: PremiumPaymentMethodRow, nextActive: boolean) => {
      if (!token?.trim() || !validId || busy) {
        return
      }
      setBusy(true)
      setError('')
      try {
        if (nextActive) {
          await enableCustomerPremiumPayment(token, customerId, row.id)
        } else {
          await disableCustomerPremiumPayment(token, customerId, row.id)
        }
        await loadAll()
      } catch (e) {
        setError(e instanceof Error ? e.message : '상태 변경에 실패했습니다.')
      } finally {
        setBusy(false)
      }
    },
    [busy, customerId, loadAll, token, validId],
  )

  const copyField = useCallback(async (label: string, value: string) => {
    const ok = await copyTextToClipboard(value)
    setCopyHint(ok ? `${label}을(를) 복사했습니다.` : '복사에 실패했습니다.')
    window.setTimeout(() => setCopyHint(''), 2000)
  }, [])

  const openReveal = useCallback((row: PremiumPaymentMethodRow) => {
    setRevealTarget(row)
    setRevealPassword('')
    setRevealedCardNumber('')
    setRevealError('')
    setRevealOpen(true)
  }, [])

  const closeReveal = useCallback(() => {
    if (busy) {
      return
    }
    setRevealOpen(false)
    setRevealTarget(null)
    setRevealPassword('')
    setRevealedCardNumber('')
    setRevealError('')
  }, [busy])

  const submitReveal = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      if (!token?.trim() || !validId || !revealTarget || busy) {
        return
      }
      if (!revealPassword.trim()) {
        setRevealError('비밀번호를 입력해 주세요.')
        return
      }
      setBusy(true)
      setRevealError('')
      try {
        const reauth = await reauthenticatePremiumPaymentCard(
          token,
          customerId,
          revealTarget.id,
          revealPassword,
        )
        const revealed = await revealPremiumPaymentCardNumber(
          token,
          customerId,
          revealTarget.id,
          reauth.reauthToken,
        )
        setRevealedCardNumber(revealed.cardNumber)
        setRevealPassword('')
      } catch (e) {
        setRevealError(e instanceof Error ? e.message : '카드번호를 확인할 수 없습니다.')
        setRevealedCardNumber('')
      } finally {
        setBusy(false)
      }
    },
    [busy, customerId, revealPassword, revealTarget, token, validId],
  )

  const copyRevealedCard = useCallback(async () => {
    if (!revealedCardNumber) {
      return
    }
    await copyField('카드번호', revealedCardNumber)
  }, [copyField, revealedCardNumber])

  return {
    rows,
    error,
    busy,
    notFound,
    formOpen,
    editing,
    form,
    setForm,
    copyHint,
    revealOpen,
    revealTarget,
    revealPassword,
    setRevealPassword,
    revealedCardNumber,
    revealError,
    formatCardExpiry,
    openCreate,
    openEdit,
    closeForm,
    submitForm,
    toggleActive,
    copyField,
    openReveal,
    closeReveal,
    submitReveal,
    copyRevealedCard,
    reload: loadAll,
  }
}

export type CustomerPremiumPaymentsState = ReturnType<typeof useCustomerPremiumPaymentsState>

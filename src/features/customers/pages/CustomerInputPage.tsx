import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { PublicPageBackButton } from '../../../components/PublicPageBackButton'
import { resolveApiUrl } from '../../../lib/apiClient'
import {
  createEmptyCustomerForm,
  CustomerFormFields,
  customerFormStateToSavePayload,
  getCustomerFormValidationError,
  type CustomerFormState,
} from '../../../components/customer/CustomerForm'
import { APP_HTML_TITLE } from '../../../config/appBrand'
import { REGISTER_LINK_PAGE_DESC, REGISTER_LINK_PAGE_TITLE } from '../lib/customerInviteRegistrationMeta'
import { inviteCustomerApiRowToFormState } from '../utils/inviteCustomerApiRowToFormState'
import {
  closePublicCustomerRegistration,
  getPublicCustomerRegistrationCloseFallbackMessage,
} from '../utils/closePublicCustomerRegistration'

const DEFAULT_APP_HTML_TITLE = APP_HTML_TITLE
const DEFAULT_HTML_DESCRIPTION = '보험 신청·고객 관리 서비스.'

type InviteSessionResp =
  | { hasSubmission: false }
  | {
      hasSubmission: true
      locked: boolean
      editableUntil: string
      canEdit: boolean
      registeredCount?: number
      customer?: Record<string, unknown>
    }

type CustomerInputFormItem = {
  localId: string
  values: CustomerFormState
}

const INVITE_BATCH_MAX = 10

function createFormItem(localId: string): CustomerInputFormItem {
  return { localId, values: createEmptyCustomerForm() }
}

function pickInviteEditableUntilIso(iso?: string | null): string {
  if (typeof iso === 'string' && iso.trim()) return iso.trim()
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
}

type Props = {
  inviteRegistrationFlow?: boolean
}

export default function CustomerInputPage({ inviteRegistrationFlow = false }: Props) {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const refParam = useMemo(() => (searchParams.get('ref') ?? '').trim(), [searchParams])
  const inviteGaCode = useMemo(() => (searchParams.get('ga') ?? '').trim().toUpperCase(), [searchParams])
  const isRegisterPathOnly = location.pathname.includes('/customer/register')

  const [notice, setNotice] = useState('')
  const nextFormIdRef = useRef(0)
  const createNextFormItem = useCallback((): CustomerInputFormItem => {
    nextFormIdRef.current += 1
    return createFormItem(`customer-form-${nextFormIdRef.current}`)
  }, [])
  const [forms, setForms] = useState<CustomerInputFormItem[]>(() => [createFormItem('customer-form-1')])
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inviteSessionBusy, setInviteSessionBusy] = useState(inviteRegistrationFlow)
  /** 초대 초대 플로우: 작성 vs 완료 */
  const [inviteUiPhase, setInviteUiPhase] = useState<'form' | 'complete'>('form')
  const [inviteSubmitKind, setInviteSubmitKind] = useState<'create' | 'update'>('create')

  const [editableUntilIso, setEditableUntilIso] = useState<string | null>(null)
  const [inviteLockedPermanent, setInviteLockedPermanent] = useState(false)
  const [inviteJustUpdated, setInviteJustUpdated] = useState(false)
  const [inviteCloseBanner, setInviteCloseBanner] = useState(false)
  const [inviteRegisteredCount, setInviteRegisteredCount] = useState(1)

  const inviteCloseFallbackMessage = getPublicCustomerRegistrationCloseFallbackMessage()

  /** 서버 시간 기준 — 클라 추정 금지, 응답의 editableUntil만 사용 */
  const resolveEditableUntilIso = (
    iso: string | null | undefined,
    fallbackDeadlineMs?: number | null,
  ): string => {
    if (typeof iso === 'string' && iso.trim()) return iso.trim()
    if (fallbackDeadlineMs != null && Number.isFinite(fallbackDeadlineMs)) {
      return new Date(fallbackDeadlineMs).toISOString()
    }
    /* 최후 폴백(이론상 응답 누락 방지용) — 실제 차단은 서버 */
    return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
  }

  const updateFormAt = useCallback((localId: string, next: CustomerFormState) => {
    setForms((prev) => prev.map((row) => (row.localId === localId ? { ...row, values: next } : row)))
    setFormErrors((prev) => {
      if (!prev[localId]) {
        return prev
      }
      const { [localId]: _removed, ...rest } = prev
      return rest
    })
  }, [])

  const handleAddForm = useCallback(() => {
    setForms((prev) => {
      if (prev.length >= INVITE_BATCH_MAX) {
        setNotice('한 번에 최대 10명까지 등록할 수 있습니다.')
        return prev
      }
      const nextItem = createNextFormItem()
      window.setTimeout(() => {
        document.getElementById(nextItem.localId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
      setNotice('')
      return [...prev, nextItem]
    })
  }, [createNextFormItem])

  const addCustomerRow = useCallback(() => {
    if (forms.length >= INVITE_BATCH_MAX) {
      setNotice('한 번에 최대 10명까지 등록할 수 있습니다.')
      return
    }
    const nextItem = createNextFormItem()
    setForms((prev) => [...prev, nextItem])
    window.setTimeout(() => {
      document.getElementById(nextItem.localId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }, [createNextFormItem, forms.length])

  const handleRemoveForm = useCallback((localId: string) => {
    setForms((prev) => {
      if (prev.length <= 1 || prev[0]?.localId === localId) {
        return prev
      }
      return prev.filter((row) => row.localId !== localId)
    })
    setFormErrors((prev) => {
      if (!prev[localId]) {
        return prev
      }
      const { [localId]: _removed, ...rest } = prev
      return rest
    })
  }, [])

  const removeCustomerAt = useCallback(
    (index: number) => {
      const target = forms[index]
      if (!target || index === 0) {
        return
      }
      handleRemoveForm(target.localId)
    },
    [forms, handleRemoveForm],
  )

  const applyInviteCompleteState = useCallback(
    ({
      editableIso,
      canEditNow,
      justUpdated,
      registeredCount = 1,
    }: {
      editableIso?: string | null
      canEditNow: boolean
      justUpdated: boolean
      registeredCount?: number
    }) => {
      setEditableUntilIso(pickInviteEditableUntilIso(editableIso))
      setInviteLockedPermanent(registeredCount === 1 ? !canEditNow : false)
      setInviteJustUpdated(justUpdated)
      setInviteRegisteredCount(Math.max(1, registeredCount))
      setInviteUiPhase('complete')
      setNotice('')
      setInviteCloseBanner(false)
      setFormErrors({})
    },
    [],
  )

  const handleInviteClose = useCallback(() => {
    setInviteCloseBanner(false)
    closePublicCustomerRegistration({
      onCannotClose: () => setInviteCloseBanner(true),
    })
  }, [])

  /** GET 세션 초기 로드 */
  useEffect(() => {
    if (!(inviteRegistrationFlow && refParam && inviteGaCode)) {
      setInviteSessionBusy(false)
      return undefined
    }
    let canceled = false
    void (async () => {
      setInviteSessionBusy(true)
      try {
        const res = await fetch(resolveApiUrl('/api/customer/external-invite-session'), {
          method: 'GET',
          credentials: 'include',
        })
        const payload = (await res.json()) as InviteSessionResp
        if (canceled) return
        if (!payload?.hasSubmission) {
          setInviteUiPhase('form')
          setInviteSubmitKind('create')
          setInviteLockedPermanent(false)
          setEditableUntilIso(null)
          return
        }
        const p = payload as Extract<InviteSessionResp, { hasSubmission: true }>
        const registeredCount = Math.max(1, Number(p.registeredCount ?? 1))
        const deadlineMs = Date.parse(p.editableUntil)
        const canNow = Boolean(p.canEdit) && Number.isFinite(deadlineMs) && Date.now() < deadlineMs
        const locked = Boolean(p.locked) || !canNow || registeredCount > 1

        setInviteSubmitKind(registeredCount > 1 ? 'create' : 'update')
        if (!locked && registeredCount === 1 && p.customer != null && typeof p.customer === 'object') {
          try {
            setForms([{ localId: 'customer-form-1', values: inviteCustomerApiRowToFormState(p.customer) }])
          } catch {
            setForms([createFormItem('customer-form-1')])
          }
        }

        applyInviteCompleteState({
          editableIso: p.editableUntil,
          canEditNow: canNow && registeredCount === 1,
          justUpdated: false,
          registeredCount,
        })
      } catch {
        if (!canceled) setNotice('세션을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.')
      } finally {
        if (!canceled) setInviteSessionBusy(false)
      }
    })()
    return () => {
      canceled = true
    }
  }, [
    inviteGaCode,
    inviteRegistrationFlow,
    applyInviteCompleteState,
    refParam,
  ])

  useEffect(() => {
    if (!inviteRegistrationFlow) return undefined

    const prevTitle = document.title
    document.title = REGISTER_LINK_PAGE_TITLE

    let metaDesc = document.querySelector('meta[name="description"]')
    if (!metaDesc) {
      metaDesc = document.createElement('meta')
      metaDesc.setAttribute('name', 'description')
      document.head.appendChild(metaDesc)
    }
    const prevDesc = metaDesc.getAttribute('content') ?? ''
    metaDesc.setAttribute('content', REGISTER_LINK_PAGE_DESC)

    const created: HTMLElement[] = []
    const ensurePair = (selector: string, build: () => HTMLMetaElement, content?: string | null) => {
      let el = document.head.querySelector(selector) as HTMLMetaElement | null
      if (!el) {
        el = build()
        document.head.appendChild(el)
        created.push(el)
      }
      if (content != null) el.setAttribute('content', content)
    }

    ensurePair('meta[property="og:title"]', () => {
      const m = document.createElement('meta')
      m.setAttribute('property', 'og:title')
      return m
    }, REGISTER_LINK_PAGE_TITLE)

    ensurePair('meta[property="og:description"]', () => {
      const m = document.createElement('meta')
      m.setAttribute('property', 'og:description')
      return m
    }, REGISTER_LINK_PAGE_DESC)

    ensurePair('meta[name="twitter:card"]', () => {
      const m = document.createElement('meta')
      m.setAttribute('name', 'twitter:card')
      return m
    }, 'summary')

    ensurePair('meta[name="twitter:title"]', () => {
      const m = document.createElement('meta')
      m.setAttribute('name', 'twitter:title')
      return m
    }, REGISTER_LINK_PAGE_TITLE)

    ensurePair('meta[name="twitter:description"]', () => {
      const m = document.createElement('meta')
      m.setAttribute('name', 'twitter:description')
      return m
    }, REGISTER_LINK_PAGE_DESC)

    return () => {
      document.title = prevTitle || DEFAULT_APP_HTML_TITLE
      metaDesc?.setAttribute('content', prevDesc || DEFAULT_HTML_DESCRIPTION)
      created.forEach((node) => {
        node.parentNode?.removeChild(node)
      })
    }
  }, [inviteRegistrationFlow])

  useEffect(() => {
    if (!inviteRegistrationFlow) return undefined

    const url = `${window.location.pathname}${window.location.search}`
    const seal = () => {
      window.history.replaceState({ inviteRegSeal: true }, '', url)
    }
    seal()
    const onPop = () => {
      seal()
      window.history.pushState({ inviteRegSeal: true }, '', url)
    }
    window.addEventListener('popstate', onPop)
    window.history.pushState({ inviteRegSeal: true }, '', url)
    return () => {
      window.removeEventListener('popstate', onPop)
    }
  }, [inviteRegistrationFlow, location.pathname, location.search])

  const scrollToForm = useCallback((localId: string) => {
    window.setTimeout(() => {
      document.getElementById(localId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }, [])

  async function handleSubmit() {
    if (!refParam) {
      setNotice('잘못된 접근입니다.')
      return
    }

    const nextErrors: Record<string, string> = {}
    let firstErrorLocalId: string | null = null
    for (const item of forms) {
      const msg = getCustomerFormValidationError(item.values)
      if (msg) {
        nextErrors[item.localId] = msg
        if (!firstErrorLocalId) {
          firstErrorLocalId = item.localId
        }
      }
    }
    if (firstErrorLocalId) {
      setFormErrors(nextErrors)
      setNotice('입력 내용을 확인해 주세요.')
      scrollToForm(firstErrorLocalId)
      return
    }
    setFormErrors({})

    setIsSubmitting(true)
    setNotice('전송 중…')

    try {
      if (inviteRegistrationFlow) {
        if (inviteSubmitKind === 'update') {
          const payload = customerFormStateToSavePayload(forms[0].values)
          const res = await fetch(resolveApiUrl('/api/customer/external-invite-registration'), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          })
          let errBody: Record<string, unknown> = {}
          if (!res.ok) {
            try {
              errBody = (await res.json()) as Record<string, unknown>
            } catch {
              errBody = {}
            }
            const msg =
              typeof errBody.message === 'string'
                ? errBody.message
                : `수정 저장에 실패했습니다 (${res.status})`
            const codeStr = typeof errBody.code === 'string' ? errBody.code : ''
            setNotice(msg)
            if (codeStr === 'EDIT_WINDOW_CLOSED') {
              setInviteLockedPermanent(true)
              applyInviteCompleteState({
                editableIso: editableUntilIso,
                canEditNow: false,
                justUpdated: false,
                registeredCount: 1,
              })
            }
            return
          }

          const raw = (await res.json()) as Record<string, unknown>
          const inv = raw.inviteRegistration as { editableUntil?: string } | undefined
          const until =
            typeof inv?.editableUntil === 'string' ? inv.editableUntil : editableUntilIso ?? null
          const deadlineMs = until != null ? Date.parse(until) : NaN
          const canNow = Number.isFinite(deadlineMs) && Date.now() < deadlineMs
          applyInviteCompleteState({
            editableIso: until,
            canEditNow: canNow,
            justUpdated: true,
            registeredCount: 1,
          })
          return
        }

        /* create — 단일·다건 모두 batch API 사용 */
        const customersPayload = forms.map((item) => customerFormStateToSavePayload(item.values))
        const res = await fetch(resolveApiUrl('/api/customer/external-invite-registration/batch'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            refUsername: refParam,
            gaCode: inviteGaCode,
            ga: inviteGaCode,
            customers: customersPayload,
          }),
        })

        if (res.status === 409) {
          let j: Record<string, unknown> = {}
          try {
            j = (await res.json()) as Record<string, unknown>
          } catch {
            j = {}
          }
          if (String(j.code ?? '') === 'ALREADY_SUBMITTED') {
            const untilIso = typeof j.editableUntil === 'string' ? j.editableUntil : null
            const canNow = j.canEdit === true
            setInviteSubmitKind('update')
            applyInviteCompleteState({
              editableIso: untilIso,
              canEditNow: canNow,
              justUpdated: false,
              registeredCount: 1,
            })
            setNotice('')
            return
          }
          setNotice('이 요청으로는 등록을 완료할 수 없습니다.')
          return
        }

        if (!res.ok) {
          let errBody: Record<string, unknown> = {}
          try {
            errBody = (await res.json()) as Record<string, unknown>
          } catch {
            errBody = {}
          }
          const batchErrors = Array.isArray(errBody.errors)
            ? (errBody.errors as Array<{ index?: number; message?: string }>)
            : null
          if (batchErrors && batchErrors.length > 0) {
            const mappedErrors: Record<string, string> = {}
            let firstBatchErrorId: string | null = null
            for (const err of batchErrors) {
              const index = Number(err.index)
              const item = forms[index]
              const message = String(err.message ?? '입력값을 확인해 주세요.')
              if (item) {
                mappedErrors[item.localId] = message
                if (!firstBatchErrorId) {
                  firstBatchErrorId = item.localId
                }
              }
            }
            setFormErrors(mappedErrors)
            if (firstBatchErrorId) {
              scrollToForm(firstBatchErrorId)
            }
            setNotice('입력 내용을 확인해 주세요.')
            return
          }
          const errMsgRaw = typeof errBody.message === 'string' ? errBody.message : undefined
          setNotice(errMsgRaw ?? '저장 실패')
          return
        }

        const raw = (await res.json()) as Record<string, unknown>
        const inv = raw.inviteRegistration as { editableUntil?: string; registeredCount?: number } | undefined
        const untilIso = typeof inv?.editableUntil === 'string' ? inv.editableUntil : null
        const createdCount = Math.max(1, Number(raw.createdCount ?? inv?.registeredCount ?? forms.length))
        const deadlineMs = untilIso != null ? Date.parse(untilIso) : NaN
        const canNow = Number.isFinite(deadlineMs) && Date.now() < deadlineMs

        setInviteSubmitKind(createdCount > 1 ? 'create' : 'update')
        applyInviteCompleteState({
          editableIso: untilIso,
          canEditNow: canNow && createdCount === 1,
          justUpdated: false,
          registeredCount: createdCount,
        })
        return
      }

      /* --- 기존 /customer/input 등 다건 전송 플로 (내부 CRM 영향 없음) --- */
      for (let i = 0; i < forms.length; i += 1) {
        const payload = customerFormStateToSavePayload(forms[i].values)
        const body: Record<string, unknown> = { ...payload }
        const isLegacyRegisterRoute = location.pathname.includes('/customer/register')

        if (isLegacyRegisterRoute) {
          body.refUsername = refParam
          body.gaCode = inviteGaCode
          body.ga = inviteGaCode
        } else if (
          /^\d+$/.test(refParam) ||
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(refParam)
        ) {
          body.refUserId = refParam
          if (inviteGaCode) {
            body.gaCode = inviteGaCode
            body.ga = inviteGaCode
          }
        } else {
          body.refUsername = refParam
          if (inviteGaCode) {
            body.gaCode = inviteGaCode
            body.ga = inviteGaCode
          }
        }

        const res = await fetch(resolveApiUrl('/api/customer/external-create'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          let errBody: Record<string, unknown> = {}
          try {
            errBody = (await res.json()) as Record<string, unknown>
          } catch {
            errBody = {}
          }
          const errMsgRaw = typeof errBody.message === 'string' ? errBody.message : undefined
          const errMsgFallback = typeof errBody.error === 'string' ? errBody.error : undefined
          const errMsg = errMsgRaw ?? errMsgFallback ?? '저장 실패'
          setNotice(`${i + 1}번째 고객: ${errMsg}`)
          setNotice(`전송 중 오류: ${i + 1}번째 고객에서 실패했습니다. (이전 고객은 이미 저장되었을 수 있습니다.)`)
          return
        }
      }

      setForms([createFormItem('customer-form-1')])
      setFormErrors({})
      setNotice('정보가 전송되었습니다.')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '전송에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!refParam) {
    return (
      <main className={inviteRegistrationFlow ? 'page invite-registration-page' : 'page page--with-back'}>
        <header
          className={
            isRegisterPathOnly && !inviteRegistrationFlow ? 'page-header page-header--has-inline-back' : 'page-header'
          }
        >
          {isRegisterPathOnly && !inviteRegistrationFlow ? (
            <div className="page-header__title-row">
              <PublicPageBackButton className="customer-register-back-btn customer-register-back-btn--inline" />
              <h1>고객 정보 입력</h1>
            </div>
          ) : (
            <h1>고객 정보 입력</h1>
          )}
          <p>유효한 링크로 접속해 주세요.</p>
        </header>
      </main>
    )
  }

  if (isRegisterPathOnly && !inviteGaCode) {
    return (
      <main className={inviteRegistrationFlow ? 'page invite-registration-page' : 'page page--with-back'}>
        <header
          className={inviteRegistrationFlow ? 'page-header' : 'page-header page-header--has-inline-back'}
        >
          {!inviteRegistrationFlow ? (
            <div className="page-header__title-row">
              <PublicPageBackButton className="customer-register-back-btn customer-register-back-btn--inline" />
              <h1>고객 정보 입력</h1>
            </div>
          ) : (
            <h1>고객 정보 입력</h1>
          )}
          <p>링크에 GA 코드(ga)가 없습니다. 담당자에게 링크를 다시 요청해 주세요.</p>
        </header>
      </main>
    )
  }

  if (inviteRegistrationFlow && inviteSessionBusy && refParam && inviteGaCode) {
    return (
      <main className="page invite-registration-page">
        <header className="page-header">
          <h1>고객 정보 입력</h1>
          <p className="page-header-hint">불러오는 중입니다…</p>
        </header>
      </main>
    )
  }

  /** 초대 전용 완료 */
  if (inviteRegistrationFlow && inviteUiPhase === 'complete') {
    const deadlineMs = editableUntilIso != null ? Date.parse(editableUntilIso) : NaN
    const withinWindow =
      inviteRegisteredCount === 1 &&
      Number.isFinite(deadlineMs) &&
      inviteLockedPermanent === false &&
      Date.now() < deadlineMs
    const isBatchComplete = inviteRegisteredCount > 1

    return (
      <main className="page invite-registration-page">
        <header className="page-header">
          <h1>{inviteLockedPermanent ? '등록 정보' : '전송 완료'}</h1>
          {inviteJustUpdated ? (
            <>
              <p className="invite-registration-complete__lead">수정이 완료되었습니다.</p>
              <p className="page-header-hint">수정은 전송 후 3시간 이내에만 가능합니다.</p>
              <p className="page-header-hint">담당자가 확인 후 연락드리겠습니다.</p>
            </>
          ) : inviteLockedPermanent ? (
            <>
              <p className="invite-registration-complete__lead">
                {isBatchComplete ? '등록이 완료되었습니다.' : '이미 등록이 완료되었습니다.'}
              </p>
              {isBatchComplete ? (
                <p className="page-header-hint">총 {inviteRegisteredCount}명이 등록되었습니다.</p>
              ) : null}
              {!isBatchComplete ? <p className="page-header-hint">수정 가능 시간이 지났습니다.</p> : null}
              <p className="page-header-hint">
                {isBatchComplete ? '담당자가 확인 후 연락드리겠습니다.' : '수정이 필요하면 담당자에게 연락해 주세요.'}
              </p>
            </>
          ) : (
            <>
              <p className="invite-registration-complete__lead">등록이 완료되었습니다.</p>
              {isBatchComplete ? (
                <p className="page-header-hint">총 {inviteRegisteredCount}명이 등록되었습니다.</p>
              ) : (
                <p className="page-header-hint">수정은 전송 후 3시간 이내에만 가능합니다.</p>
              )}
              <p className="page-header-hint">담당자가 확인 후 연락드리겠습니다.</p>
            </>
          )}
        </header>

        {inviteCloseBanner ? (
          <p className="invite-registration-complete__muted" role="status">
            {inviteCloseFallbackMessage}
          </p>
        ) : null}

        <div className="invite-registration-complete__actions">
          {withinWindow ? (
            <FormButton
              variant="secondary"
              htmlType="button"
              onClick={() => {
                setInviteUiPhase('form')
                setInviteSubmitKind('update')
                setInviteJustUpdated(false)
                setInviteCloseBanner(false)
                setNotice('')
              }}
            >
              수정하기
            </FormButton>
          ) : null}
          <FormButton variant="secondary" htmlType="button" onClick={handleInviteClose}>
            닫기
          </FormButton>
        </div>
      </main>
    )
  }

  return (
    <main
      className={
        inviteRegistrationFlow ? 'page invite-registration-page customers-page' : 'page customers-page page--with-back'
      }
    >
      <header className={isRegisterPathOnly && !inviteRegistrationFlow ? 'page-header page-header--has-inline-back' : 'page-header'}>
        {isRegisterPathOnly && !inviteRegistrationFlow ? (
          <div className="page-header__title-row">
            <PublicPageBackButton className="customer-register-back-btn customer-register-back-btn--inline" />
            <h1>고객 정보 입력</h1>
          </div>
        ) : (
          <h1>고객 정보 입력</h1>
        )}
        {!inviteRegistrationFlow && inviteGaCode ? (
          <p className="page-header-hint" style={{ marginTop: 6 }}>
            소속 GA 코드: <strong>{inviteGaCode}</strong>
          </p>
        ) : null}

        {!inviteRegistrationFlow ? (
          notice ? (
            <p>{notice}</p>
          ) : (
            <p className="page-header-hint">(필수: 이름)</p>
          )
        ) : notice.trim().length > 0 ? (
          <p className="page-header-notice" role="status">
            {notice}
          </p>
        ) : (
          <p className="page-header-hint">필수: 이름 외 선택 항목은 비워두셔도 됩니다.</p>
        )}
      </header>

      <div className="external-input-body">
        {forms.map((item, index) => (
          <div key={item.localId} id={item.localId} className="customer-card">
            <div className="customer-title">고객 {index + 1}</div>
            <CustomerFormFields
              form={item.values}
              onFormChange={(next) => updateFormAt(item.localId, next)}
              radioSuffix={`external-${item.localId}`}
              onStatusMessage={setNotice}
            />
            {formErrors[item.localId] ? (
              <p className="page-header-notice" role="alert">
                {formErrors[item.localId]}
              </p>
            ) : null}
            {inviteRegistrationFlow && forms.length > 1 && index > 0 ? (
              <div style={{ marginTop: 12 }}>
                <FormButton
                  className="button button--secondary"
                  htmlType="button"
                  variant="secondary"
                  onClick={() => handleRemoveForm(item.localId)}
                >
                  삭제
                </FormButton>
              </div>
            ) : null}
            {!inviteRegistrationFlow && forms.length > 1 && index > 0 ? (
              <div style={{ marginTop: 12 }}>
                <FormButton
                  className="button button--secondary"
                  htmlType="button"
                  variant="secondary"
                  onClick={() => removeCustomerAt(index)}
                >
                  이 고객 칸 삭제
                </FormButton>
              </div>
            ) : null}
          </div>
        ))}

        {inviteRegistrationFlow ? (
          <div className="add-btn-wrap">
            <FormButton
              className="button button--secondary"
              htmlType="button"
              variant="secondary"
              disabled={forms.length >= INVITE_BATCH_MAX}
              onClick={handleAddForm}
            >
              + 추가
            </FormButton>
          </div>
        ) : (
          <div className="add-btn-wrap">
            <FormButton
              className="button button--secondary"
              htmlType="button"
              variant="secondary"
              disabled={forms.length >= INVITE_BATCH_MAX}
              onClick={addCustomerRow}
            >
              + 고객 추가
            </FormButton>
          </div>
        )}

        <FormButton
          className="button button--primary button--full"
          htmlType="button"
          variant="primary"
          disabled={isSubmitting}
          onClick={handleSubmit}
          style={{ marginTop: 8 }}
          loading={isSubmitting}
          loadingText={inviteSubmitKind === 'update' ? '수정 저장 중…' : '전송 중…'}
        >
          {inviteRegistrationFlow && inviteSubmitKind === 'update' ? '수정 전송' : '전송'}
        </FormButton>
      </div>
    </main>
  )
}

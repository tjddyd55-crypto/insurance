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
import {
  closePublicCustomerRegistration,
  getPublicCustomerRegistrationCloseFallbackMessage,
} from '../utils/closePublicCustomerRegistration'

const DEFAULT_APP_HTML_TITLE = APP_HTML_TITLE
const DEFAULT_HTML_DESCRIPTION = '보험 신청·고객 관리 서비스.'

type CustomerInputFormItem = {
  localId: string
  values: CustomerFormState
}

const INVITE_BATCH_MAX = 10

function clearStaleInviteSessionCookie(): void {
  void fetch(resolveApiUrl('/api/customer/external-invite-session/reset'), {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {
    /* reset 실패해도 입력 폼 유지 */
  })
}

function createFormItem(localId: string): CustomerInputFormItem {
  return { localId, values: createEmptyCustomerForm() }
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
  const [inviteUiPhase, setInviteUiPhase] = useState<'form' | 'complete'>('form')
  const [inviteCloseBanner, setInviteCloseBanner] = useState(false)
  const [inviteRegisteredCount, setInviteRegisteredCount] = useState(1)

  const inviteCloseFallbackMessage = getPublicCustomerRegistrationCloseFallbackMessage()

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

  const applyInviteCompleteState = useCallback((registeredCount: number) => {
    setInviteRegisteredCount(Math.max(1, registeredCount))
    setInviteUiPhase('complete')
    setNotice('')
    setInviteCloseBanner(false)
    setFormErrors({})
  }, [])

  const handleInviteClose = useCallback(() => {
    setInviteCloseBanner(false)
    closePublicCustomerRegistration({
      onCannotClose: () => setInviteCloseBanner(true),
    })
  }, [])

  /** 링크 진입·새로고침 시 stale invite cookie만 제거. 완료 화면은 복원하지 않는다. */
  useEffect(() => {
    if (!(inviteRegistrationFlow && refParam && inviteGaCode)) {
      return undefined
    }
    clearStaleInviteSessionCookie()
    return undefined
  }, [inviteGaCode, inviteRegistrationFlow, refParam])

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
            clearStaleInviteSessionCookie()
            setNotice('등록 세션이 남아 있습니다. 잠시 후 다시 전송해 주세요.')
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
        const createdCount = Math.max(0, Number(raw.createdCount ?? 0))
        if (raw.ok !== true || createdCount < 1) {
          setNotice('저장에 실패했습니다.')
          return
        }

        applyInviteCompleteState(createdCount)
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


  /** 초대 전용 완료 */
  if (inviteRegistrationFlow && inviteUiPhase === 'complete') {
    return (
      <main className="page invite-registration-page">
        <header className="page-header">
          <h1>전송 완료</h1>
          <p className="invite-registration-complete__lead">등록이 완료되었습니다.</p>
          {inviteRegisteredCount > 1 ? (
            <p className="page-header-hint">총 {inviteRegisteredCount}명이 등록되었습니다.</p>
          ) : null}
          <p className="page-header-hint">담당자가 확인 후 연락드리겠습니다.</p>
        </header>

        {inviteCloseBanner ? (
          <p className="invite-registration-complete__muted" role="status">
            {inviteCloseFallbackMessage}
          </p>
        ) : null}

        <div className="invite-registration-complete__actions">
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
          loadingText="전송 중…"
        >
          전송
        </FormButton>
      </div>
    </main>
  )
}

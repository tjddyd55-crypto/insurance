import { useCallback, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { resolveApiUrl } from '../../../lib/apiClient'
import {
  createEmptyCustomerForm,
  CustomerFormFields,
  customerFormStateToSavePayload,
  getCustomerFormValidationError,
  type CustomerFormState,
} from '../../../components/customer/CustomerForm'
import { PageBackButton } from '../../../components/common/PageBackButton'

export default function CustomerInputPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const refParam = useMemo(() => (searchParams.get('ref') ?? '').trim(), [searchParams])
  const inviteGaCode = useMemo(() => (searchParams.get('ga') ?? '').trim().toUpperCase(), [searchParams])
  const isRegisterPath = location.pathname.includes('/customer/register')
  const [notice, setNotice] = useState('')
  const [customers, setCustomers] = useState<CustomerFormState[]>(() => [createEmptyCustomerForm()])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateCustomerAt = useCallback((index: number, next: CustomerFormState) => {
    setCustomers((prev) => prev.map((row, i) => (i === index ? next : row)))
  }, [])

  const addCustomerRow = useCallback(() => {
    setCustomers((prev) => [...prev, createEmptyCustomerForm()])
    window.setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }, 100)
  }, [])

  const removeCustomerAt = useCallback((index: number) => {
    setCustomers((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }, [])

  async function handleSubmit() {
    console.log('전송 클릭됨')

    if (!refParam) {
      window.alert('잘못된 접근입니다')
      return
    }

    for (let i = 0; i < customers.length; i += 1) {
      const msg = getCustomerFormValidationError(customers[i])
      if (msg) {
        setNotice(`${i + 1}번째 고객: ${msg}`)
        window.alert(msg)
        return
      }
    }

    console.log('전송 시작')
    setIsSubmitting(true)
    setNotice('전송 중…')

    try {
      for (let i = 0; i < customers.length; i += 1) {
        const payload = customerFormStateToSavePayload(customers[i])
        const body: Record<string, unknown> = { ...payload }
        if (isRegisterPath) {
          body.refUsername = refParam
          body.gaCode = inviteGaCode
          body.ga = inviteGaCode
        } else if (/^\d+$/.test(refParam) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(refParam)) {
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
          const errJson = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
          const errMsg = errJson.message ?? errJson.error ?? '저장 실패'
          console.error('external-create failed', res.status, errMsg)
          setNotice(`${i + 1}번째 고객: ${errMsg}`)
          window.alert(
            `전송 중 오류: ${i + 1}번째 고객에서 실패했습니다. (이전 고객은 이미 저장되었을 수 있습니다.)`,
          )
          return
        }
      }

      setCustomers([createEmptyCustomerForm()])
      setNotice('정보가 전송되었습니다.')
      window.alert('전송 완료')
    } catch (e) {
      console.error(e)
      window.alert('전송 실패')
      setNotice(e instanceof Error ? e.message : '전송에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!refParam) {
    return (
      <main className="page page--with-back">
        <PageBackButton />
        <header className="page-header">
          <h1>고객 정보 입력</h1>
          <p>유효한 링크로 접속해 주세요.</p>
        </header>
      </main>
    )
  }

  if (isRegisterPath && !inviteGaCode) {
    return (
      <main className="page page--with-back">
        <PageBackButton />
        <header className="page-header">
          <h1>고객 정보 입력</h1>
          <p>링크에 GA 코드(ga)가 없습니다. 담당자에게 링크를 다시 요청해 주세요.</p>
        </header>
      </main>
    )
  }

  return (
    <main className="page customers-page page--with-back">
      <PageBackButton />
      <header className="page-header">
        <h1>고객 정보 입력</h1>
        {inviteGaCode ? (
          <p className="page-header-hint" style={{ marginTop: 6 }}>
            소속 GA 코드: <strong>{inviteGaCode}</strong>
          </p>
        ) : null}
        {notice ? <p>{notice}</p> : <p className="page-header-hint">(필수: 이름)</p>}
      </header>

      <div className="external-input-body">
        {customers.map((row, index) => (
          <div key={index} className="customer-card">
            <div className="customer-title">고객 {index + 1}</div>
            <CustomerFormFields
              form={row}
              onFormChange={(next) => updateCustomerAt(index, next)}
              radioSuffix={`external-${index}`}
              onStatusMessage={setNotice}
            />
            {customers.length > 1 ? (
              <div style={{ marginTop: 12 }}>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => removeCustomerAt(index)}
                >
                  이 고객 칸 삭제
                </button>
              </div>
            ) : null}
          </div>
        ))}

        <div className="add-btn-wrap">
          <button className="button button--secondary" type="button" onClick={addCustomerRow}>
            + 고객 추가
          </button>
        </div>

        <button
          className="button button--primary button--full"
          type="button"
          disabled={isSubmitting}
          onClick={handleSubmit}
          style={{ marginTop: 8 }}
        >
          {isSubmitting ? '전송 중…' : '전송'}
        </button>
      </div>
    </main>
  )
}

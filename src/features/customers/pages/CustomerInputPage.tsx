import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  const refUserId = useMemo(() => (searchParams.get('ref') ?? '').trim(), [searchParams])
  const [notice, setNotice] = useState('')
  const [customers, setCustomers] = useState<CustomerFormState[]>(() => [createEmptyCustomerForm()])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateCustomerAt = useCallback((index: number, next: CustomerFormState) => {
    setCustomers((prev) => prev.map((row, i) => (i === index ? next : row)))
  }, [])

  const addCustomerRow = useCallback(() => {
    setCustomers((prev) => [...prev, createEmptyCustomerForm()])
  }, [])

  const removeCustomerAt = useCallback((index: number) => {
    setCustomers((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }, [])

  async function handleSubmit() {
    console.log('전송 클릭됨')

    if (!refUserId) {
      window.alert('잘못된 접근입니다')
      return
    }

    for (let i = 0; i < customers.length; i += 1) {
      const msg = getCustomerFormValidationError(customers[i])
      if (msg) {
        setNotice(`${i + 1}번째 고객: ${msg}`)
        window.alert(`${i + 1}번째 고객: ${msg}`)
        return
      }
    }

    console.log('전송 시작')
    setIsSubmitting(true)
    setNotice('전송 중…')

    try {
      for (let i = 0; i < customers.length; i += 1) {
        const payload = customerFormStateToSavePayload(customers[i])
        const body = { refUserId, ...payload }

        const res = await fetch('/api/customer/external-create', {
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

  if (!refUserId) {
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

  return (
    <main className="page customers-page page--with-back">
      <PageBackButton />
      <header className="page-header">
        <h1>고객 정보 입력</h1>
        <p>
          {notice ||
            '가족 등 여러 분의 정보를 각 블록에 입력한 뒤 전송해 주세요. (로그인 불필요) · 전송은 한 분씩 저장됩니다.'}
        </p>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <button className="button button--secondary" type="button" onClick={addCustomerRow}>
          고객 추가
        </button>
      </div>

      <section className="card" style={{ marginTop: 0 }}>
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

        <button
          className="button button--primary button--full"
          type="button"
          disabled={isSubmitting}
          onClick={handleSubmit}
          style={{ marginTop: 8 }}
        >
          {isSubmitting ? '전송 중…' : '전송'}
        </button>
      </section>
    </main>
  )
}

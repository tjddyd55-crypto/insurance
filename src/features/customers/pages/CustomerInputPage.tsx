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

import { saveCustomerExternal } from '../api/customersApi'

import type { CustomerRecord } from '../domain/types'

import { generateCustomerText } from '../utils/customerText'



function formStateToCopyRecord(form: CustomerFormState): Partial<CustomerRecord> {

  return {

    name: form.name.trim(),

    gender: form.gender,

    ssn: form.ssn,

    isDriver: form.isDriver,

    carType: form.carType,

    notes: form.notes,

  }

}



async function copyOneCustomer(form: CustomerFormState) {

  const text = generateCustomerText(formStateToCopyRecord(form))

  try {

    await navigator.clipboard.writeText(text)

    window.alert('복사되었습니다')

  } catch {

    window.alert('클립보드 복사에 실패했습니다.')

  }

}



export default function CustomerInputPage() {

  const [searchParams] = useSearchParams()

  const ref = useMemo(() => (searchParams.get('ref') ?? '').trim(), [searchParams])

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



  async function handleSubmitAll() {

    if (!ref) {

      setNotice('유효하지 않은 링크입니다.')

      return

    }



    for (let i = 0; i < customers.length; i += 1) {

      const msg = getCustomerFormValidationError(customers[i])

      if (msg) {

        setNotice(`${i + 1}번째 고객: ${msg}`)

        return

      }

    }



    setIsSubmitting(true)

    setNotice('전송 중…')

    try {

      for (let i = 0; i < customers.length; i += 1) {

        const payload = customerFormStateToSavePayload(customers[i])

        try {

          await saveCustomerExternal(ref, payload)

        } catch (err) {

          const msg = err instanceof Error ? err.message : '저장 실패'

          console.error(err)

          setNotice(`${i + 1}번째 고객: ${msg}`)

          window.alert(

            `전송 중 오류: ${i + 1}번째 고객에서 실패했습니다. (이전 고객은 이미 저장되었을 수 있습니다.)`,

          )

          return

        }

      }

      setCustomers([createEmptyCustomerForm()])

      setNotice('정보가 전송되었습니다.')

      window.alert('전체 전송 완료')

    } finally {

      setIsSubmitting(false)

    }

  }



  if (!ref) {

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

          <div key={index} style={{ marginTop: index === 0 ? 0 : 24, paddingTop: index === 0 ? 0 : 20, borderTop: index === 0 ? undefined : '1px solid var(--border)' }}>

            <h2 className="dashboard-section-title" style={{ marginBottom: 10 }}>

              고객 {index + 1}

            </h2>

            <CustomerFormFields

              form={row}

              onFormChange={(next) => updateCustomerAt(index, next)}

              radioSuffix={`external-${index}`}

              onStatusMessage={setNotice}

            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>

              <button className="button button--secondary" type="button" onClick={() => void copyOneCustomer(row)}>

                이 고객만 복사

              </button>

              {customers.length > 1 ? (

                <button className="button button--secondary" type="button" onClick={() => removeCustomerAt(index)}>

                  이 고객 칸 삭제

                </button>

              ) : null}

            </div>

          </div>

        ))}



        <button

          className="button button--primary button--full"

          type="button"

          disabled={isSubmitting}

          onClick={() => void handleSubmitAll()}

          style={{ marginTop: 16 }}

        >

          {isSubmitting ? '전송 중…' : '전송'}

        </button>

      </section>

    </main>

  )

}



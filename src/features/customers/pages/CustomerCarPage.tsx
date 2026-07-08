import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormButton, FormInput } from '../../../components/form'
import AppDateInput from '../../../components/common/AppDateInput'
import { useAuth } from '../../auth/AuthProvider'
import { updateCustomerCar } from '../api/customersApi'
import { clearSelectedCustomer, readSelectedCustomer } from '../storage/selectedCustomerStorage'

type CarFormState = {
  id: number
  carNumber: string
  carModel: string
  carYear: string
  renewalDate: string
}

export default function CustomerCarPage() {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [statusText, setStatusText] = useState(() => {
    const data = readSelectedCustomer()
    return data?.id ? '' : '선택된 고객이 없습니다. 고객 관리에서 다시 선택해 주세요.'
  })
  const [form, setForm] = useState<CarFormState | null>(() => {
    const data = readSelectedCustomer()
    if (!data?.id) {
      return null
    }
    return {
      id: data.id,
      carNumber: data.carNumber ?? '',
      carModel: data.carModel ?? '',
      carYear: data.carYear ?? '',
      renewalDate: data.renewalDate ?? '',
    }
  })

  async function handleSaveCar() {
    if (!token || user?.role !== 'USER' || !form) {
      setStatusText('저장할 수 없습니다.')
      return
    }
    try {
      await updateCustomerCar(token, form.id, {
        carNumber: form.carNumber,
        carModel: form.carModel,
        carYear: form.carYear,
        renewalDate: form.renewalDate,
      })
      clearSelectedCustomer()
      navigate('/customers?mode=list', { replace: true })
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '저장에 실패했습니다.')
    }
  }

  if (user?.role !== 'USER') {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <h1>자동차 정보 입력</h1>
          <p>접근 권한 없음</p>
        </header>
      </main>
    )
  }

  if (!form) {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <h1>자동차 정보 입력</h1>
          <p>{statusText}</p>
        </header>
        <FormButton htmlType="button" fullWidth onClick={() => navigate('/customers')}>
          고객 관리로
        </FormButton>
      </main>
    )
  }

  return (
    <main className="page page--with-back">
      <header className="page-header">
        <h1>자동차 정보 입력</h1>
        <p>{statusText || '차량 정보를 저장하면 고객 카드에 반영됩니다.'}</p>
      </header>

      <section className="card">
        <div className="field-grid-customers">
          <label className="field field--wide">
            <span className="field__label">차량번호</span>
            <FormInput
              className="field__control"
              placeholder="차량번호"
              value={form.carNumber}
              onChange={(e) => setForm({ ...form, carNumber: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field__label">차종</span>
            <FormInput
              className="field__control"
              placeholder="차종"
              value={form.carModel}
              onChange={(e) => setForm({ ...form, carModel: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field__label">연식</span>
            <FormInput
              className="field__control"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder="연식"
              value={form.carYear}
              onChange={(e) =>
                setForm({ ...form, carYear: e.target.value.replace(/\D/g, '').slice(0, 4) })
              }
            />
          </label>
          <label className="field field--wide">
            <span className="field__label">만기(갱신)일</span>
            <AppDateInput
              inputClassName="field__control"
              value={form.renewalDate ?? ''}
              onChange={(renewalDate) => setForm({ ...form, renewalDate })}
            />
          </label>
        </div>
        <div className="record-card__actions" style={{ marginTop: 12 }}>
          <FormButton variant="secondary" htmlType="button" onClick={() => navigate('/customers')}>
            취소
          </FormButton>
          <FormButton variant="primary" htmlType="button" onClick={() => void handleSaveCar()}>
            저장
          </FormButton>
        </div>
      </section>
    </main>
  )
}

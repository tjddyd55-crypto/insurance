import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { updateCustomerCar } from '../api/customersApi'
import { clearSelectedCustomer, readSelectedCustomer } from '../storage/selectedCustomerStorage'
import { PageBackButton } from '../../../components/common/PageBackButton'

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
  const [form, setForm] = useState<CarFormState | null>(null)
  const [statusText, setStatusText] = useState('')

  useEffect(() => {
    const data = readSelectedCustomer()
    if (!data?.id) {
      setStatusText('선택된 고객이 없습니다. 고객 관리에서 다시 선택해 주세요.')
      setForm(null)
      return
    }
    setForm({
      id: data.id,
      carNumber: data.carNumber ?? '',
      carModel: data.carModel ?? '',
      carYear: data.carYear ?? '',
      renewalDate: data.renewalDate ?? '',
    })
  }, [])

  async function handleSaveCar() {
    if (!token || user?.role !== 'user' || !form) {
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
      window.alert('차량 정보 저장 완료')
      clearSelectedCustomer()
      navigate('/customers', { replace: true })
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '저장에 실패했습니다.')
    }
  }

  if (user?.role !== 'user') {
    return (
      <main className="page page--with-back">
        <PageBackButton />
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
        <PageBackButton />
        <header className="page-header">
          <h1>자동차 정보 입력</h1>
          <p>{statusText}</p>
        </header>
        <button className="button button--full" type="button" onClick={() => navigate('/customers')}>
          고객 관리로
        </button>
      </main>
    )
  }

  return (
    <main className="page page--with-back">
      <PageBackButton />
      <header className="page-header">
        <h1>자동차 정보 입력</h1>
        <p>{statusText || '차량 정보를 저장하면 고객 카드에 반영됩니다.'}</p>
      </header>

      <section className="card">
        <div className="field-grid-customers">
          <label className="field field--wide">
            <span className="field__label">차량번호</span>
            <input
              className="field__control"
              placeholder="차량번호"
              value={form.carNumber}
              onChange={(e) => setForm({ ...form, carNumber: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field__label">차종</span>
            <input
              className="field__control"
              placeholder="차종"
              value={form.carModel}
              onChange={(e) => setForm({ ...form, carModel: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field__label">연식</span>
            <input
              className="field__control"
              placeholder="연식"
              inputMode="numeric"
              value={form.carYear}
              onChange={(e) => setForm({ ...form, carYear: e.target.value })}
            />
          </label>
          <label className="field field--wide">
            <span className="field__label">만기(갱신)일</span>
            <input
              className="field__control"
              type="date"
              value={form.renewalDate}
              onChange={(e) => setForm({ ...form, renewalDate: e.target.value })}
            />
          </label>
        </div>
        <div className="record-card__actions" style={{ marginTop: 12 }}>
          <button className="button button--secondary" type="button" onClick={() => navigate('/customers')}>
            취소
          </button>
          <button className="button button--primary" type="button" onClick={() => void handleSaveCar()}>
            저장
          </button>
        </div>
      </section>
    </main>
  )
}

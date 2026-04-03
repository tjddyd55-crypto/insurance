import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CustomerForm } from '../../../components/customer/CustomerForm'

export default function CustomerInputPage() {
  const [searchParams] = useSearchParams()
  const ref = useMemo(() => (searchParams.get('ref') ?? '').trim(), [searchParams])
  const [notice, setNotice] = useState('')

  if (!ref) {
    return (
      <main className="page">
        <header className="page-header">
          <h1>고객 정보 입력</h1>
          <p>유효한 링크로 접속해 주세요.</p>
        </header>
      </main>
    )
  }

  return (
    <main className="page customers-page">
      <header className="page-header">
        <h1>고객 정보 입력</h1>
        <p>{notice || '아래 정보를 입력한 뒤 전송해 주세요. (로그인 불필요)'}</p>
      </header>
      <section className="card" style={{ marginTop: 0 }}>
        <CustomerForm mode="external" refUserId={ref} onStatusMessage={setNotice} />
      </section>
    </main>
  )
}

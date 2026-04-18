import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { clearCustomerAppSession, readCustomerAppSession } from '../session/customerAppSession'

interface Props {
  title: string
  children: ReactNode
}

export default function CustomerAppShell({ title, children }: Props) {
  const navigate = useNavigate()
  const session = readCustomerAppSession()

  const logout = () => {
    clearCustomerAppSession()
    navigate('/customer-app', { replace: true })
  }

  return (
    <main className="content-wrapper py-4 space-y-3 max-w-2xl">
      <header className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3">
        <div className="text-sm font-semibold">고객 앱</div>
        <div className="text-xs text-[var(--text-secondary)] mt-1">
          {session ? `${session.customerName} · 담당 ${session.agentName}` : '연결이 필요합니다'}
        </div>
        <div className="flex gap-2 mt-2 text-xs flex-wrap">
          <Link to="/customer-app/home" className="text-blue-600">
            홈
          </Link>
          <Link to="/customer-app/requests/new" className="text-blue-600">
            청구 요청하기
          </Link>
          <Link to="/customer-app/requests" className="text-blue-600">
            요청 내역
          </Link>
          <Link to="/customer-app/news" className="text-blue-600">
            소식지
          </Link>
          {session ? (
            <FormButton htmlType="button" className="text-xs text-red-500 !p-0 !h-auto" onClick={logout}>
              연결 초기화
            </FormButton>
          ) : null}
        </div>
      </header>
      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 space-y-3">
        <h1 className="text-base font-semibold">{title}</h1>
        {children}
      </section>
    </main>
  )
}

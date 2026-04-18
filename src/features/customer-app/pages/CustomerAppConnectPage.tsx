import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import { FormButton, FormInput } from '../../../components/form'
import { connectCustomerApp } from '../api/customerAppApi'
import {
  readCustomerAppSession,
  resolveCustomerDeviceId,
  writeCustomerAppSession,
} from '../session/customerAppSession'

export default function CustomerAppConnectPage() {
  const { linkCode: linkCodeParam } = useParams<{ linkCode?: string }>()
  const navigate = useNavigate()
  const session = useMemo(() => readCustomerAppSession(), [])
  const [linkCode, setLinkCode] = useState(String(linkCodeParam ?? '').trim().toUpperCase())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleConnect = async () => {
    const code = linkCode.trim().toUpperCase()
    if (!code) {
      setError('링크 코드를 입력해 주세요.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const deviceId = resolveCustomerDeviceId()
      const connected = await connectCustomerApp({
        linkCode: code,
        deviceId,
        devicePlatform: /android/i.test(navigator.userAgent)
          ? 'android'
          : /iphone|ipad|ipod/i.test(navigator.userAgent)
            ? 'ios'
            : 'web',
        appVersion: 'web-1.0.0',
      })
      writeCustomerAppSession({
        appToken: connected.appToken,
        agentId: connected.agentId,
        customerId: connected.customerId,
        deviceId,
        agentName: connected.agentName,
        customerName: connected.customerName,
      })
      navigate('/customer-app/home', { replace: true })
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : '연결에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="content-wrapper py-6 max-w-xl">
      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 space-y-3">
        <h1 className="text-lg font-semibold">고객 앱 연결</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          설계사가 전달한 링크 코드를 입력하면 바로 연결됩니다. 회원가입이나 비밀번호 입력은 필요하지 않습니다.
        </p>
        <FormInput
          className="w-full"
          value={linkCode}
          onChange={(event) => setLinkCode(event.target.value.toUpperCase())}
          placeholder="예: ABC123XYZ"
          autoComplete="off"
        />
        <FormButton htmlType="button" variant="primary" onClick={() => void handleConnect()} loading={loading}>
          연결하기
        </FormButton>
        <StatusMessage message={error} tone="error" />
        {session ? (
          <FormButton
            htmlType="button"
            variant="secondary"
            className="text-xs !p-0 !h-auto text-blue-600"
            onClick={() => navigate('/customer-app/home', { replace: true })}
          >
            기존 연결({session.customerName})로 홈 이동
          </FormButton>
        ) : null}
      </section>
    </main>
  )
}

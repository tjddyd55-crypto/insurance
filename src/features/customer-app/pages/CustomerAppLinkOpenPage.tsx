import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { StatusMessage } from '../../../components/feedback'
import { getPublicOrigin } from '../../../lib/publicOrigin'

const DEEP_SCHEME = 'insurancecustomer://connect'
const AUTO_OPEN_DELAY_MS = 400

function readLinkCode(searchParams: URLSearchParams): string {
  const raw = String(searchParams.get('code') ?? searchParams.get('token') ?? '').trim()
  return raw.toUpperCase()
}

function buildDeepLink(code: string): string {
  const c = encodeURIComponent(code)
  return `${DEEP_SCHEME}?code=${c}`
}

/**
 * 고객앱 연결용 https fallback — 카카오톡/문자 등에서 열리면 네이티브 앱 실행을 시도하고,
 * 미설치 시 웹 연결(/customer-app/connect/:code)으로 유도한다.
 */
export default function CustomerAppLinkOpenPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const code = useMemo(() => readLinkCode(searchParams), [searchParams])
  const [autoTried, setAutoTried] = useState(false)
  const [hint, setHint] = useState('')
  const triedRef = useRef(false)

  const webConnectPath = useMemo(() => {
    if (!code) return '/customer-app'
    return `/customer-app/connect/${encodeURIComponent(code)}`
  }, [code])

  const webConnectAbsolute = useMemo(() => {
    try {
      return new URL(webConnectPath, getPublicOrigin()).href
    } catch {
      return webConnectPath
    }
  }, [webConnectPath])

  useEffect(() => {
    if (!code || triedRef.current) {
      return
    }
    triedRef.current = true
    const t = window.setTimeout(() => {
      setAutoTried(true)
      try {
        window.location.href = buildDeepLink(code)
      } catch {
        setHint('앱 열기를 시도했지만 브라우저에서 막혔을 수 있습니다. 아래 버튼을 눌러 주세요.')
      }
    }, AUTO_OPEN_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [code])

  const openApp = () => {
    setHint('')
    try {
      window.location.href = buildDeepLink(code)
    } catch {
      setHint('앱 열기에 실패했습니다. 웹에서 연결하기를 이용해 주세요.')
    }
  }

  if (!code) {
    return (
      <main className="content-wrapper py-6 max-w-xl">
        <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 space-y-3">
          <h1 className="text-lg font-semibold">연결 링크</h1>
          <p className="text-sm text-[var(--text-secondary)]">링크에 연결 코드가 없습니다. 설계사에게 새 링크를 요청해 주세요.</p>
          <FormButton htmlType="button" variant="secondary" onClick={() => navigate('/customer-app', { replace: true })}>
            고객 앱 홈으로
          </FormButton>
        </section>
      </main>
    )
  }

  return (
    <main className="content-wrapper py-6 max-w-xl">
      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 space-y-4">
        <h1 className="text-lg font-semibold">고객 앱 연결</h1>
        <p className="text-sm text-[var(--text-secondary)] leading-6">
          설치된 <strong className="text-[var(--text-main)]">고객 앱</strong>이 있으면 자동으로 열립니다. 열리지 않으면 아래에서 앱을 실행하거나, 웹
          브라우저로 연결을 진행해 주세요.
        </p>
        {autoTried ? (
          <p className="text-xs text-[var(--text-secondary)] m-0">앱이 설치되어 있다면 잠시 후 자동으로 전환됩니다.</p>
        ) : (
          <p className="text-xs text-[var(--text-secondary)] m-0">고객 앱 실행을 준비하는 중…</p>
        )}
        <div className="flex flex-col gap-2">
          <FormButton htmlType="button" variant="primary" className="w-full min-h-[44px]" onClick={() => openApp()}>
            고객 앱에서 열기
          </FormButton>
          <FormButton
            htmlType="button"
            variant="secondary"
            className="w-full min-h-[44px]"
            onClick={() => navigate(webConnectPath, { replace: true })}
          >
            웹에서 연결하기
          </FormButton>
        </div>
        <p className="text-xs text-[var(--text-secondary)] m-0 leading-5">
          앱이 없다면{' '}
          <Link className="text-blue-500 underline" to="/introduction/install">
            설치 안내
          </Link>
          를 확인하거나, 웹 연결 화면에서 코드를 직접 입력할 수 있습니다.
        </p>
        <a className="text-xs text-blue-500 underline break-all" href={webConnectAbsolute}>
          {webConnectAbsolute}
        </a>
        <StatusMessage message={hint} />
      </section>
    </main>
  )
}

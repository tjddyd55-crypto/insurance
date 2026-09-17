import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FormButton } from '../../../components/form'

function readParam(searchParams: URLSearchParams, key: string): string {
  return String(searchParams.get(key) ?? '').trim()
}

/**
 * CRM 담당자용 https 진입점 — 카카오 알림톡·SMS에서 열리면
 * 1) Native ONE FC 앱 custom scheme 시도
 * 2) 실패 시 Web CRM fallback route
 */
export default function StaffNativeOpenPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const target = useMemo(() => readParam(searchParams, 'target'), [searchParams])
  const nativeDeepLink = useMemo(() => readParam(searchParams, 'native'), [searchParams])
  const fallbackPath = useMemo(() => {
    const raw = readParam(searchParams, 'fallback')
    if (raw.startsWith('/')) return raw
    return ''
  }, [searchParams])

  useEffect(() => {
    if (!target) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      if (cancelled) return
      if (fallbackPath) {
        navigate(fallbackPath, { replace: true })
      }
    }, 1200)

    if (nativeDeepLink) {
      window.location.href = nativeDeepLink
    } else if (fallbackPath) {
      navigate(fallbackPath, { replace: true })
      window.clearTimeout(timer)
      return () => {
        cancelled = true
        window.clearTimeout(timer)
      }
    }

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [fallbackPath, nativeDeepLink, navigate, target])

  if (!target) {
    return (
      <main className="content-wrapper py-6 max-w-xl">
        <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 space-y-3">
          <h1 className="text-lg font-semibold">앱 열기</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            링크 정보가 올바르지 않습니다. ONE FC 앱에서 다시 시도하거나 담당자에게 문의해 주세요.
          </p>
          <FormButton htmlType="button" variant="secondary" onClick={() => navigate('/', { replace: true })}>
            홈으로
          </FormButton>
        </section>
      </main>
    )
  }

  return (
    <main className="content-wrapper py-6 max-w-xl">
      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 space-y-3">
        <h1 className="text-lg font-semibold">ONE FC 열기</h1>
        <p className="text-sm text-[var(--text-secondary)] m-0">앱으로 이동하는 중…</p>
        {fallbackPath ? (
          <FormButton
            htmlType="button"
            variant="secondary"
            onClick={() => navigate(fallbackPath, { replace: true })}
          >
            웹에서 계속
          </FormButton>
        ) : null}
      </section>
    </main>
  )
}

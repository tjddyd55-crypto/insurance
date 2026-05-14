import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import { FormButton, FormInput } from '../../../components/form'
import { ApiError } from '../../../lib/apiClient'
import {
  connectCustomerApp,
  CUSTOMER_APP_PROFILE_INCOMPLETE_CODE,
  getCustomerAppConnectPrefill,
  type CustomerAppConnectPrefill,
} from '../api/customerAppApi'
import {
  readCustomerAppSession,
  resolveCustomerDeviceId,
  writeCustomerAppProfile,
  writeCustomerAppSession,
} from '../session/customerAppSession'
import { useCustomerAppSession } from '../session/useCustomerAppSession'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function resolveDevicePlatform(): 'android' | 'ios' | 'web' {
  if (/android/i.test(navigator.userAgent)) {
    return 'android'
  }
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    return 'ios'
  }
  return 'web'
}

function hasRequiredDesignatedProfile(prefill: CustomerAppConnectPrefill | null): boolean {
  return Boolean(
    String(prefill?.name ?? '').trim() &&
      String(prefill?.birthDate ?? '').trim() &&
      String(prefill?.phone ?? '').trim(),
  )
}

export default function CustomerAppConnectPage() {
  const { linkCode: linkCodeParam } = useParams<{ linkCode?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const session = useCustomerAppSession()
  const [linkCode, setLinkCode] = useState(String(linkCodeParam ?? '').trim().toUpperCase())
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [prefillLoading, setPrefillLoading] = useState(false)
  const [error, setError] = useState('')
  const [prefillError, setPrefillError] = useState('')
  const [prefill, setPrefill] = useState<CustomerAppConnectPrefill | null>(null)
  const [serverDesignatedProfileIncomplete, setServerDesignatedProfileIncomplete] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installHintOpen, setInstallHintOpen] = useState(false)
  const [installResult, setInstallResult] = useState('')

  const didAutoConnectRef = useRef(false)

  useEffect(() => {
    const qp = String(searchParams.get('code') ?? searchParams.get('token') ?? '').trim()
    if (linkCodeParam || !qp) {
      return
    }
    const qs = new URLSearchParams(window.location.search)
    qs.delete('code')
    qs.delete('token')
    const tail = qs.toString() ? `?${qs.toString()}` : ''
    navigate(`/customer-app/connect/${encodeURIComponent(qp)}${tail}`, { replace: true })
  }, [linkCodeParam, navigate, searchParams])

  useEffect(() => {
    didAutoConnectRef.current = false
    setServerDesignatedProfileIncomplete(false)
  }, [linkCodeParam])

  useEffect(() => {
    const code = String(linkCodeParam ?? '').trim().toUpperCase()
    setLinkCode(code)
    setPrefill(null)
    setPrefillError('')
    setServerDesignatedProfileIncomplete(false)
    if (!code) {
      return
    }
    let cancelled = false
    setPrefillLoading(true)
    void getCustomerAppConnectPrefill(code)
      .then((nextPrefill) => {
        if (cancelled || !nextPrefill) {
          return
        }
        setPrefill(nextPrefill)
        setName(nextPrefill.name || '')
        setBirthDate(nextPrefill.birthDate || '')
        setPhone(nextPrefill.phone || '')
        setPrefillError('')
      })
      .catch((prefillLoadError) => {
        if (cancelled) {
          return
        }
        setPrefill(null)
        setPrefillError(prefillLoadError instanceof Error ? prefillLoadError.message : '고객 정보 자동 입력에 실패했습니다.')
      })
      .finally(() => {
        if (!cancelled) {
          setPrefillLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [linkCodeParam])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent
      event.preventDefault()
      setDeferredPrompt(installEvent)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const platform = useMemo(() => {
    const ua = navigator.userAgent.toLowerCase()
    const isIos = /iphone|ipad|ipod/.test(ua)
    const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|chrome|android/.test(ua)
    if (isIos && isSafari) {
      return 'ios-safari'
    }
    if (/android/.test(ua) && /chrome|chromium|crios/.test(ua)) {
      return 'android-chrome'
    }
    return 'other'
  }, [])

  const isDesignatedLink = Boolean(linkCodeParam) && prefill?.mode === 'designated'
  const designatedPrefillProfileIncomplete = isDesignatedLink && Boolean(prefill?.isActive) && !hasRequiredDesignatedProfile(prefill)
  const designatedConnectBlocked =
    isDesignatedLink && Boolean(prefill?.isActive) && (designatedPrefillProfileIncomplete || serverDesignatedProfileIncomplete)

  const persistAfterConnect = useCallback(
    (connected: Awaited<ReturnType<typeof connectCustomerApp>>, code: string, deviceId: string) => {
      const prof = connected.profile
      const requesterName = prof?.name ?? connected.customerName
      const requesterBirthDate = prof?.birthDate ?? ''
      const requesterPhone = prof?.phone ?? ''
      writeCustomerAppSession({
        appToken: connected.appToken,
        agentId: connected.agentId,
        customerId: connected.customerId,
        deviceId,
        agentName: connected.agentName,
        customerName: connected.customerName,
        linkCode: code,
        requesterName,
        requesterBirthDate,
        requesterPhone,
      })
      writeCustomerAppProfile({
        name: requesterName,
        birthDate: requesterBirthDate,
        phone: requesterPhone,
      })
    },
    [],
  )

  const runConnect = async (opts: {
    code: string
    useServerCustomerProfile: boolean
    requester?: { name: string; birthDate: string; phone: string }
    navigateToHome: boolean
  }) => {
    const code = opts.code.trim().toUpperCase()
    if (!code) {
      setError('링크 코드를 입력해 주세요.')
      return
    }
    if (!opts.useServerCustomerProfile) {
      const r = opts.requester
      if (!r?.name?.trim() || !r?.birthDate?.trim() || !r?.phone?.trim()) {
        setError('이름, 생년월일, 연락처를 모두 입력해 주세요.')
        return
      }
    }
    setLoading(true)
    setError('')
    try {
      const deviceId = resolveCustomerDeviceId()
      const connected = await connectCustomerApp({
        linkCode: code,
        deviceId,
        devicePlatform: resolveDevicePlatform(),
        appVersion: 'web-1.0.0',
        ...(opts.useServerCustomerProfile ? {} : { requester: opts.requester! }),
      })
      persistAfterConnect(connected, code, deviceId)
      setServerDesignatedProfileIncomplete(false)
      if (opts.navigateToHome) {
        navigate('/customer-app/home', { replace: true })
      }
    } catch (connectError) {
      if (
        isDesignatedLink &&
        opts.useServerCustomerProfile &&
        connectError instanceof ApiError &&
        connectError.status === 422 &&
        connectError.code === CUSTOMER_APP_PROFILE_INCOMPLETE_CODE
      ) {
        setServerDesignatedProfileIncomplete(true)
        setError('')
      } else {
        setError(connectError instanceof Error ? connectError.message : '연결에 실패했습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleConnectWithRequester = async (payload: {
    code: string
    requesterName: string
    requesterBirthDate: string
    requesterPhone: string
  }) => {
    await runConnect({
      code: payload.code,
      useServerCustomerProfile: false,
      requester: {
        name: payload.requesterName.trim(),
        birthDate: payload.requesterBirthDate.trim(),
        phone: payload.requesterPhone.trim(),
      },
      navigateToHome: true,
    })
  }

  const handleConnectViaServerProfile = async (code: string, navigateToHome: boolean) => {
    await runConnect({
      code,
      useServerCustomerProfile: true,
      navigateToHome,
    })
  }

  const handleConnect = async () => {
    await handleConnectWithRequester({
      code: linkCode.trim().toUpperCase(),
      requesterName: name.trim(),
      requesterBirthDate: birthDate.trim(),
      requesterPhone: phone.trim(),
    })
  }

  const handleStartClaim = async () => {
    if (designatedConnectBlocked) {
      return
    }
    if (!prefill?.isActive) {
      setError('해당 링크는 만료되었거나 사용할 수 없습니다.')
      return
    }
    await handleConnectViaServerProfile(linkCode.trim().toUpperCase(), true)
  }

  const handleAddToHome = async () => {
    setInstallResult('')
    setError('')
    if (designatedConnectBlocked) {
      return
    }
    if (isDesignatedLink && prefill?.isActive) {
      await handleConnectViaServerProfile(linkCode.trim().toUpperCase(), false)
    }
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      setInstallResult(choice.outcome === 'accepted' ? '홈 화면 추가 요청을 완료했습니다.' : '홈 화면 추가를 취소했습니다.')
      setDeferredPrompt(null)
      return
    }
    setInstallHintOpen(true)
  }

  useEffect(() => {
    if (!isDesignatedLink || !prefill?.isActive || prefillLoading || designatedConnectBlocked) {
      return
    }
    const code = String(linkCodeParam ?? '').trim().toUpperCase()
    if (!code) {
      return
    }
    const existing = readCustomerAppSession()
    if (existing?.linkCode?.toUpperCase() === code) {
      navigate('/customer-app/home', { replace: true })
      return
    }
    if (didAutoConnectRef.current) {
      return
    }
    didAutoConnectRef.current = true
    let cancelled = false
    void (async () => {
      try {
        const deviceId = resolveCustomerDeviceId()
        const connected = await connectCustomerApp({
          linkCode: code,
          deviceId,
          devicePlatform: resolveDevicePlatform(),
          appVersion: 'web-1.0.0',
        })
        if (cancelled) {
          return
        }
        persistAfterConnect(connected, code, deviceId)
        setServerDesignatedProfileIncomplete(false)
        navigate('/customer-app/home', { replace: true })
      } catch (autoErr) {
        didAutoConnectRef.current = false
        if (!cancelled) {
          if (
            autoErr instanceof ApiError &&
            autoErr.status === 422 &&
            autoErr.code === CUSTOMER_APP_PROFILE_INCOMPLETE_CODE
          ) {
            setServerDesignatedProfileIncomplete(true)
            setError('')
          } else {
            setError(autoErr instanceof Error ? autoErr.message : '연결에 실패했습니다.')
          }
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isDesignatedLink, prefill?.isActive, prefillLoading, designatedConnectBlocked, linkCodeParam, persistAfterConnect, navigate])

  if (linkCodeParam && prefillLoading) {
    return (
      <main className="content-wrapper py-6 max-w-xl">
        <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
          <StatusMessage message="고객 전용 링크 정보를 확인하고 있습니다." />
        </section>
      </main>
    )
  }

  if (isDesignatedLink) {
    const displayName = String(prefill?.customerName ?? '').trim() || '고객'
    return (
      <main className="content-wrapper py-6 max-w-xl">
        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-5 py-6 space-y-4 text-center">
          <div className="text-3xl" aria-hidden="true">
            🛡️
          </div>
          <h1 className="text-xl font-semibold">{displayName}님의 전용 페이지입니다</h1>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            보험금 청구 자료 제출, 담당 설계사 메시지 확인, 소식지 확인을 이곳에서 할 수 있습니다.
          </p>

          {prefill?.isActive ? (
            <div className="space-y-2">
              <FormButton
                htmlType="button"
                variant="primary"
                className="w-full min-h-[44px]"
                onClick={() => void handleStartClaim()}
                loading={loading}
                disabled={designatedConnectBlocked}
              >
                청구하기
              </FormButton>
              <FormButton
                htmlType="button"
                variant="secondary"
                className="w-full min-h-[44px]"
                onClick={() => void handleAddToHome()}
                loading={loading}
                disabled={designatedConnectBlocked}
              >
                홈 화면에 추가
              </FormButton>
            </div>
          ) : (
            <StatusMessage
              message="해당 링크는 만료되었거나 사용할 수 없습니다. 담당 설계사에게 새 링크를 요청해 주세요."
            />
          )}

          {designatedConnectBlocked ? (
            <div className="status status--error text-sm text-left space-y-1.5" role="alert">
              <p className="m-0 leading-6">고객앱 연결에 필요한 정보가 부족합니다.</p>
              <p className="m-0 leading-6">담당 설계사에게 이름, 생년월일, 연락처 등록을 요청해 주세요.</p>
            </div>
          ) : null}

          <p className="text-xs text-[var(--text-secondary)]">
            홈 화면에 추가하면 다음부터 앱처럼 바로 열 수 있습니다.
          </p>
          <StatusMessage message={installResult} />
          <StatusMessage message={prefillError} />
          <StatusMessage message={designatedConnectBlocked ? '' : error} tone="error" />
        </section>

        {installHintOpen ? (
          <section className="mt-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-2">
            <h2 className="text-sm font-semibold">
              {platform === 'ios-safari' ? 'iPhone 홈 화면 추가 방법' : '홈 화면 추가 안내'}
            </h2>
            {platform === 'ios-safari' ? (
              <ol className="text-xs leading-6 text-[var(--text-secondary)] list-decimal pl-4">
                <li>하단 또는 상단의 공유 버튼을 누르세요.</li>
                <li>홈 화면에 추가를 선택하세요.</li>
                <li>오른쪽 위 추가를 누르세요.</li>
              </ol>
            ) : (
              <ol className="text-xs leading-6 text-[var(--text-secondary)] list-decimal pl-4">
                <li>브라우저 메뉴를 연 뒤 홈 화면에 추가 또는 앱 설치를 선택하세요.</li>
                <li>표시되는 안내를 따라 추가를 완료하세요.</li>
              </ol>
            )}
            <FormButton htmlType="button" variant="secondary" className="w-full min-h-[44px]" onClick={() => setInstallHintOpen(false)}>
              닫기
            </FormButton>
          </section>
        ) : null}
      </main>
    )
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
        <FormInput
          className="w-full"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="이름"
          autoComplete="name"
        />
        <FormInput
          className="w-full"
          value={birthDate}
          onChange={(event) => setBirthDate(event.target.value)}
          placeholder="생년월일 (예: 900101)"
          autoComplete="bday"
        />
        <FormInput
          className="w-full"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="연락처 (예: 010-1234-5678)"
          autoComplete="tel"
        />
        <FormButton htmlType="button" variant="primary" onClick={() => void handleConnect()} loading={loading}>
          연결하기
        </FormButton>
        <StatusMessage message={prefillLoading ? '고객 정보를 확인하고 있습니다.' : ''} />
        <StatusMessage message={prefillError} />
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

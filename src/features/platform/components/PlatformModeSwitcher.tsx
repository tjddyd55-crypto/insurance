import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { FormButton } from '../../../components/form'
import { usePlatformAccess } from '../hooks/usePlatformAccess'
import type { PlatformAccessMode } from '../platformAdmin.types'

const MODE_LABEL: Record<PlatformAccessMode, string> = {
  platform: 'Platform Mode',
  industry: 'Industry Mode',
  tenant: 'Tenant Mode',
  work: 'Work Mode',
}

type Props = {
  token: string | null | undefined
}

/** 대시보드·업무 라우트( /admin 제외 )에서 work 모드로 추정 */
function isWorkLikePath(pathname: string): boolean {
  if (pathname.startsWith('/admin/')) {
    return false
  }
  if (pathname === '/dashboard') {
    return true
  }
  const prefixes = [
    '/customers',
    '/customer/',
    '/memo',
    '/storage',
    '/team/',
    '/application',
    '/claim-requests',
    '/feature-request',
    '/profile',
    '/insurer-managers',
    '/loss-adjusters',
    '/customer-car',
    '/my-forms',
    '/form',
    '/account/',
    '/insurance/',
  ]
  return prefixes.some((p) => pathname === p || pathname.startsWith(p))
}

function inferModeFromPathname(
  pathname: string,
  modes: readonly PlatformAccessMode[],
): PlatformAccessMode | null {
  if (pathname === '/admin/platform' || pathname.startsWith('/admin/platform/')) {
    return modes.includes('platform') ? 'platform' : null
  }
  if (/^\/admin\/industry\/[^/]+/.test(pathname)) {
    return modes.includes('industry') ? 'industry' : null
  }
  if (/^\/admin\/tenant\/[^/]+/.test(pathname)) {
    return modes.includes('tenant') ? 'tenant' : null
  }
  if (isWorkLikePath(pathname)) {
    return modes.includes('work') ? 'work' : null
  }
  return null
}

function resolveActiveMode(
  summary: NonNullable<ReturnType<typeof usePlatformAccess>['summary']>,
  pathname: string,
  userPickedMode: boolean,
  pickedMode: PlatformAccessMode | null,
): PlatformAccessMode | null {
  const modes = summary.availableModes
  if (modes.length === 0) {
    return null
  }
  const inferred = inferModeFromPathname(pathname, modes)
  if (inferred != null) {
    return inferred
  }
  if (userPickedMode && pickedMode && modes.includes(pickedMode)) {
    return pickedMode
  }
  if (!userPickedMode) {
    return summary.defaultMode != null && modes.includes(summary.defaultMode)
      ? summary.defaultMode
      : modes[0]!
  }
  return pickedMode != null && modes.includes(pickedMode) ? pickedMode : modes[0] ?? null
}

/**
 * 플랫폼 접근 요약 기반 모드 표시·선택 + 대상 라우트로 navigate (로컬 스토리지·서버 미동기화).
 */
export default function PlatformModeSwitcher({ token }: Props) {
  const trimmed = typeof token === 'string' ? token.trim() : ''
  const navigate = useNavigate()
  const location = useLocation()
  const { loading, error, summary, reload } = usePlatformAccess(trimmed || null)
  const [pickedMode, setPickedMode] = useState<PlatformAccessMode | null>(null)
  const [userPickedMode, setUserPickedMode] = useState(false)
  const [notice, setNotice] = useState<{ path: string; text: string } | null>(null)

  const activeMode = useMemo(() => {
    if (!trimmed || error || !summary) {
      return null
    }
    return resolveActiveMode(summary, location.pathname, userPickedMode, pickedMode)
  }, [trimmed, error, summary, location.pathname, userPickedMode, pickedMode])

  const visibleNotice = notice?.path === location.pathname ? notice.text : null

  if (!trimmed) {
    return null
  }

  if (error) {
    return (
      <div
        className="platform-mode-switcher platform-mode-switcher--error"
        role="status"
        aria-live="polite"
      >
        <span className="platform-mode-switcher__muted">모드 정보를 불러오지 못했습니다.</span>
        <FormButton
          htmlType="button"
          variant="secondary"
          className="platform-mode-switcher__retry"
          onClick={() => void reload()}
        >
          다시 시도
        </FormButton>
      </div>
    )
  }

  if (loading && !summary) {
    return (
      <div
        className="platform-mode-switcher platform-mode-switcher--loading"
        role="status"
        aria-live="polite"
      >
        불러오는 중…
      </div>
    )
  }

  if (!summary) {
    return null
  }

  const modes = summary.availableModes
  const blockNavigate = Boolean(loading || error)

  const defaultLabel =
    summary.defaultMode != null && modes.includes(summary.defaultMode)
      ? MODE_LABEL[summary.defaultMode]
      : '—'

  if (modes.length === 0) {
    return (
      <div className="platform-mode-switcher" role="region" aria-label="플랫폼 모드">
        <span className="platform-mode-switcher__muted">사용 가능한 모드 없음</span>
        {loading ? (
          <span className="platform-mode-switcher__loading-inline" aria-hidden>
            {' '}
            (갱신 중)
          </span>
        ) : null}
      </div>
    )
  }

  const listLabel = modes.map((m) => MODE_LABEL[m]).join(', ')

  const handleSelectMode = (next: PlatformAccessMode) => {
    if (blockNavigate || !summary) {
      return
    }
    if (!modes.includes(next)) {
      return
    }

    setNotice(null)

    if (next === 'platform') {
      setUserPickedMode(true)
      setPickedMode('platform')
      navigate('/admin/platform', { replace: true })
      return
    }

    if (next === 'industry') {
      const id = summary.industryAdminIndustryIds[0]
      if (id == null || String(id).trim() === '') {
        setNotice({ path: location.pathname, text: '이동 가능한 업종이 없습니다.' })
        return
      }
      setUserPickedMode(true)
      setPickedMode('industry')
      navigate(`/admin/industry/${encodeURIComponent(String(id).trim())}`, { replace: true })
      return
    }

    if (next === 'tenant') {
      const id = summary.tenantAdminTenantIds[0]
      if (id == null || String(id).trim() === '') {
        setNotice({ path: location.pathname, text: '이동 가능한 테넌트가 없습니다.' })
        return
      }
      setUserPickedMode(true)
      setPickedMode('tenant')
      navigate(`/admin/tenant/${encodeURIComponent(String(id).trim())}`, { replace: true })
      return
    }

    if (next === 'work') {
      setUserPickedMode(true)
      setPickedMode('work')
      navigate('/dashboard', { replace: true })
      return
    }

    setNotice({ path: location.pathname, text: '모드 이동 대상을 찾지 못했습니다.' })
  }

  return (
    <div className="platform-mode-switcher" role="region" aria-label="플랫폼 모드">
      <div className="platform-mode-switcher__row platform-mode-switcher__row--meta">
        <span className="platform-mode-switcher__meta">
          기본: <strong className="platform-mode-switcher__strong">{defaultLabel}</strong>
        </span>
        <span className="platform-mode-switcher__meta" title={listLabel}>
          가용: <span className="platform-mode-switcher__mono">{listLabel}</span>
        </span>
        {loading ? (
          <span className="platform-mode-switcher__loading-inline" aria-live="polite">
            갱신 중…
          </span>
        ) : null}
      </div>
      <div className="platform-mode-switcher__row platform-mode-switcher__row--pick">
        <label className="platform-mode-switcher__label" htmlFor="platform-mode-switcher-select">
          현재 선택
        </label>
        <select
          id="platform-mode-switcher-select"
          className="platform-mode-switcher__select"
          disabled={blockNavigate}
          value={activeMode ?? modes[0] ?? ''}
          onChange={(e) => {
            const next = e.target.value as PlatformAccessMode
            handleSelectMode(next)
          }}
        >
          {modes.map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </select>
      </div>
      {visibleNotice ? (
        <p className="platform-mode-switcher__notice" role="alert">
          {visibleNotice}
        </p>
      ) : null}
    </div>
  )
}

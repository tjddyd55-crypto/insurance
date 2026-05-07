import { useEffect, useState } from 'react'

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

/**
 * 플랫폼 접근 요약 기반 모드 표시·선택(로컬 state만, 서버/스토어 미동기화).
 * `/admin/platform` 계열 라우트에서만 상위에서 마운트한다.
 */
export default function PlatformModeSwitcher({ token }: Props) {
  const trimmed = typeof token === 'string' ? token.trim() : ''
  const { loading, error, summary, reload } = usePlatformAccess(trimmed || null)
  const [activeMode, setActiveMode] = useState<PlatformAccessMode | null>(null)
  const [userPickedMode, setUserPickedMode] = useState(false)

  useEffect(() => {
    if (error) {
      setUserPickedMode(false)
      setActiveMode(null)
    }
  }, [error])

  useEffect(() => {
    if (!trimmed) {
      setActiveMode(null)
      setUserPickedMode(false)
    }
  }, [trimmed])

  useEffect(() => {
    if (!summary) {
      return
    }
    const modes = summary.availableModes
    if (modes.length === 0) {
      setActiveMode(null)
      return
    }
    if (!userPickedMode) {
      const next =
        summary.defaultMode != null && modes.includes(summary.defaultMode)
          ? summary.defaultMode
          : modes[0]!
      setActiveMode(next)
      return
    }
    setActiveMode((prev) =>
      prev != null && !modes.includes(prev) ? modes[0] ?? null : prev,
    )
  }, [summary, userPickedMode])

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
          value={activeMode ?? modes[0] ?? ''}
          onChange={(e) => {
            const next = e.target.value as PlatformAccessMode
            if (modes.includes(next)) {
              setUserPickedMode(true)
              setActiveMode(next)
            }
          }}
        >
          {modes.map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

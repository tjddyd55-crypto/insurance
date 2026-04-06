import { useCallback, useEffect, useState } from 'react'
import { getActiveTheme, toggleColorScheme } from '../theme/colorScheme'

export function ThemeToggle() {
  const [mode, setMode] = useState<'dark' | 'light'>(() => getActiveTheme())

  useEffect(() => {
    setMode(getActiveTheme())
  }, [])

  const onToggle = useCallback(() => {
    const next = toggleColorScheme()
    setMode(next)
  }, [])

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-pressed={mode === 'dark'}
      aria-label={mode === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
      title={mode === 'dark' ? '라이트 모드' : '다크 모드'}
    >
      <span className="theme-toggle__icon" aria-hidden>
        {mode === 'dark' ? '☀️' : '🌙'}
      </span>
      <span className="theme-toggle__label">{mode === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  )
}

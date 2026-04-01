import { useCallback, useEffect, useState } from 'react'
import { getActiveTheme, toggleColorScheme } from '../theme/colorScheme'

export function ThemeToggle() {
  const [mode, setMode] = useState< 'dark' | 'light'>(() => getActiveTheme())

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
      title={mode === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      {mode === 'dark' ? '☀️ 라이트' : '🌙 다크'}
    </button>
  )
}

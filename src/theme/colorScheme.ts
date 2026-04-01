/** localStorage에 저장된 값이 있으면 우선, 없으면 시스템 prefers-color-scheme */

const STORAGE_KEY = 'insurance-theme'

export type ThemePreference = 'dark' | 'light'

export function getStoredTheme(): ThemePreference | null {
  const v = localStorage.getItem(STORAGE_KEY)
  if (v === 'dark' || v === 'light') {
    return v
  }
  return null
}

export function isDarkPreferredBySystem(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function initColorScheme(): void {
  const stored = getStoredTheme()
  const useDark = stored === 'dark' || (stored === null && isDarkPreferredBySystem())
  document.body.classList.toggle('dark', useDark)
}

/** 저장된 선호가 없을 때만 시스템 테마 변경을 반영 */
export function subscribeSystemColorScheme(): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => {
    if (getStoredTheme() !== null) {
      return
    }
    document.body.classList.toggle('dark', mq.matches)
  }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}

export function setTheme(mode: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, mode)
  document.body.classList.toggle('dark', mode === 'dark')
}

export function toggleColorScheme(): ThemePreference {
  const next: ThemePreference = document.body.classList.contains('dark') ? 'light' : 'dark'
  setTheme(next)
  return next
}

export function getActiveTheme(): ThemePreference {
  return document.body.classList.contains('dark') ? 'dark' : 'light'
}

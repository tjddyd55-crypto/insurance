/** 테마 저장·토글 유틸. 앱 부팅 시 `initColorScheme()`이 저장값 또는 light 기본을 적용한다. */

const STORAGE_KEY = 'theme'
const LEGACY_STORAGE_KEY = 'insurance-theme'

export type ThemePreference = 'dark' | 'light'

function applyThemeToDocument(mode: ThemePreference): void {
  document.documentElement.setAttribute('data-theme', mode)
  document.body.classList.toggle('dark', mode === 'dark')
}

export function getStoredTheme(): ThemePreference | null {
  const v = localStorage.getItem(STORAGE_KEY)
  if (v === 'dark' || v === 'light') {
    return v
  }
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (legacy === 'dark' || legacy === 'light') {
    localStorage.setItem(STORAGE_KEY, legacy)
    return legacy
  }
  return null
}

export function isDarkPreferredBySystem(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** 저장된 선호가 있으면 따르고, 없으면 light 기본. */
export function initColorScheme(): void {
  const stored = getStoredTheme()
  applyThemeToDocument(stored ?? 'light')
}

/** 저장된 선호가 없을 때만 시스템 테마 변경을 반영 */
export function subscribeSystemColorScheme(): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => {
    if (getStoredTheme() !== null) {
      return
    }
    applyThemeToDocument(mq.matches ? 'dark' : 'light')
  }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}

export function setTheme(mode: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, mode)
  localStorage.setItem(LEGACY_STORAGE_KEY, mode)
  applyThemeToDocument(mode)
}

export function toggleColorScheme(): ThemePreference {
  const next: ThemePreference = getActiveTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

export function getActiveTheme(): ThemePreference {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

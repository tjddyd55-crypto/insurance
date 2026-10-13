const STORAGE_KEY = 'personal-binder:last-selected-id'

export function readLastSelectedBinderId(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)?.trim()
    return value || null
  } catch {
    return null
  }
}

export function writeLastSelectedBinderId(binderId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, binderId)
  } catch {
    /* ignore quota / private mode */
  }
}

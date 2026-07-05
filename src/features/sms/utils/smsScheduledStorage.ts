import type { SmsScheduledRule } from '../types/smsScheduled.types'

const STORAGE_PREFIX = 'insurance.smsScheduledRules.v1'

function storageKey(userKey: string): string {
  return `${STORAGE_PREFIX}:${userKey}`
}

export function loadSmsScheduledRules(userKey: string): SmsScheduledRule[] {
  if (typeof window === 'undefined' || !userKey) {
    return []
  }
  try {
    const raw = window.localStorage.getItem(storageKey(userKey))
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((row): row is SmsScheduledRule => {
      return Boolean(row && typeof row === 'object' && typeof (row as SmsScheduledRule).id === 'string')
    })
  } catch {
    return []
  }
}

export function saveSmsScheduledRules(userKey: string, rules: SmsScheduledRule[]): void {
  if (typeof window === 'undefined' || !userKey) {
    return
  }
  window.localStorage.setItem(storageKey(userKey), JSON.stringify(rules))
}

export function createScheduledRuleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `sched-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

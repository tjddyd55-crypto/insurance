const CUSTOMER_APP_SESSION_KEY = 'insurance.customer-app.session'

export interface CustomerAppSession {
  appToken: string
  agentId: string
  customerId: number
  deviceId: string
  agentName: string
  customerName: string
}

export function readCustomerAppSession(): CustomerAppSession | null {
  try {
    const raw = window.localStorage.getItem(CUSTOMER_APP_SESSION_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as CustomerAppSession
    if (!parsed?.appToken || !parsed?.agentId || !parsed?.customerId || !parsed?.deviceId) {
      return null
    }
    return {
      appToken: String(parsed.appToken),
      agentId: String(parsed.agentId),
      customerId: Number(parsed.customerId),
      deviceId: String(parsed.deviceId),
      agentName: String(parsed.agentName ?? ''),
      customerName: String(parsed.customerName ?? ''),
    }
  } catch {
    return null
  }
}

export function writeCustomerAppSession(session: CustomerAppSession): void {
  window.localStorage.setItem(CUSTOMER_APP_SESSION_KEY, JSON.stringify(session))
}

export function clearCustomerAppSession(): void {
  window.localStorage.removeItem(CUSTOMER_APP_SESSION_KEY)
}

export function resolveCustomerDeviceId(): string {
  const key = 'insurance.customer-app.device-id'
  const existing = window.localStorage.getItem(key)
  if (existing && existing.trim()) {
    return existing
  }
  const created =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`
  window.localStorage.setItem(key, created)
  return created
}

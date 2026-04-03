import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { mockFindInsurerManager } from './mock/sessions'
import type { InsurerNewsAdminSession } from './types'

const STORAGE_KEY = 'insurer-news-admin-session-v1'

function readStoredSession(): InsurerNewsAdminSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as InsurerNewsAdminSession
    if (!parsed?.accountId || !parsed?.gaCode || !parsed?.insurerCode) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStoredSession(session: InsurerNewsAdminSession | null) {
  try {
    if (!session) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    /* ignore */
  }
}

type Ctx = {
  session: InsurerNewsAdminSession | null
  login: (username: string, password: string) => { ok: true } | { ok: false; message: string }
  logout: () => void
}

const InsurerNewsAdminContext = createContext<Ctx | null>(null)

export function InsurerNewsAdminProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<InsurerNewsAdminSession | null>(() => readStoredSession())

  const login = useCallback((username: string, password: string) => {
    const acc = mockFindInsurerManager(username, password)
    if (!acc) {
      return { ok: false as const, message: '아이디 또는 비밀번호가 올바르지 않습니다.' }
    }
    const next: InsurerNewsAdminSession = {
      accountId: acc.id,
      gaCode: acc.gaCode,
      insurerCode: acc.insurerCode,
      insurerName: acc.insurerName,
      username: acc.username,
    }
    setSession(next)
    writeStoredSession(next)
    return { ok: true as const }
  }, [])

  const logout = useCallback(() => {
    setSession(null)
    writeStoredSession(null)
  }, [])

  const value = useMemo(() => ({ session, login, logout }), [session, login, logout])

  return <InsurerNewsAdminContext.Provider value={value}>{children}</InsurerNewsAdminContext.Provider>
}

export function useInsurerNewsAdminSession(): Ctx {
  const ctx = useContext(InsurerNewsAdminContext)
  if (!ctx) {
    throw new Error('useInsurerNewsAdminSession must be used within InsurerNewsAdminProvider')
  }
  return ctx
}

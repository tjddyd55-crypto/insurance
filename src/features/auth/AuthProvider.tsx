import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { UserRole } from './authApi'

interface AuthUser {
  id: string
  username: string
  role: UserRole
}

interface AuthSession {
  token: string
  user: AuthUser
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  login: (session: AuthSession) => void
  logout: () => void
}

const AUTH_STORAGE_KEY = 'insurance.auth.session'
const ALLOWED_ROLES: UserRole[] = ['super_admin', 'staff', 'user']
const AuthContext = createContext<AuthContextValue | null>(null)

function isValidRole(value: unknown): value is UserRole {
  return typeof value === 'string' && ALLOWED_ROLES.includes(value as UserRole)
}

function readStoredSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as AuthSession
    if (!parsed?.token || !parsed?.user?.id) {
      return null
    }

    if (!isValidRole(parsed.user.role)) {
      console.warn('role 없음 → 재로그인 필요')
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      return null
    }

    return {
      token: parsed.token,
      user: {
        id: String(parsed.user.id),
        username: String(parsed.user.username ?? ''),
        role: parsed.user.role,
      },
    }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession())

  const logout = useCallback(() => {
    setSession(null)
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
  }, [])

  const login = useCallback(
    (nextSession: AuthSession) => {
      if (!isValidRole(nextSession.user?.role)) {
        console.warn('role 없음 → 재로그인 필요')
        logout()
        return
      }
      setSession(nextSession)
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession))
    },
    [logout],
  )

  useEffect(() => {
    if (!session?.user) {
      return
    }
    if (!session.user.role) {
      console.warn('role 없음 → 재로그인 필요')
      logout()
    }
  }, [session, logout])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session?.token),
      login,
      logout,
    }),
    [session, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

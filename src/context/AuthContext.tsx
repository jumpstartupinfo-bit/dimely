import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { auth as authApi, setToken, clearToken, type AuthUser, type Profile } from '../lib/api'

interface AuthState {
  user: AuthUser | null
  profile: Profile | null
  referralCode: string | null
  referralSlug: string | null
  loading: boolean
  isLoggedIn: boolean
}

const LOGGED_OUT: AuthState = {
  user: null, profile: null, referralCode: null, referralSlug: null, loading: false, isLoggedIn: false,
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  signup: (payload: Parameters<typeof authApi.signup>[0]) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchMe(): Promise<AuthState> {
  const token = localStorage.getItem('dimely_token')
  if (!token) return { ...LOGGED_OUT }
  try {
    const data = await authApi.me()
    return {
      user: data.user,
      profile: data.profile,
      referralCode: data.referralCode,
      referralSlug: data.referralSlug,
      loading: false,
      isLoggedIn: true,
    }
  } catch {
    clearToken()
    return { ...LOGGED_OUT }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...LOGGED_OUT, loading: true })

  // Initial session restore — async, no synchronous setState in the effect body
  useEffect(() => {
    let cancelled = false
    fetchMe()
      .then((next) => { if (!cancelled) setState(next) })
      .catch(() => { if (!cancelled) setState({ ...LOGGED_OUT }) })
    return () => { cancelled = true }
  }, [])

  const refreshMe = useCallback(async () => {
    const next = await fetchMe()
    setState(next)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    setToken(res.token)
    const next = await fetchMe()
    setState(next)
  }, [])

  const signup = useCallback(async (payload: Parameters<typeof authApi.signup>[0]) => {
    const res = await authApi.signup(payload)
    setToken(res.token)
    const next = await fetchMe()
    setState(next)
  }, [])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    clearToken()
    setState({ ...LOGGED_OUT })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

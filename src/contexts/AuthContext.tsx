import { createContext, useContext, useState, type ReactNode } from 'react'
import { getStoredAuth, getStoredName, setStoredAuth, setStoredName, type AuthLevel } from '@/lib/auth'

interface AuthContextValue {
  authLevel: AuthLevel
  userName: string
  login: (level: AuthLevel, name: string) => void
  logout: () => void
  isUser: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authLevel, setAuthLevel] = useState<AuthLevel>(getStoredAuth)
  const [userName, setUserName]   = useState<string>(getStoredName)

  function login(level: AuthLevel, name: string) {
    setAuthLevel(level)
    setUserName(name)
    setStoredAuth(level)
    setStoredName(name)
  }

  function logout() {
    setAuthLevel('none')
    setUserName('')
    setStoredAuth('none')
    setStoredName('')
  }

  return (
    <AuthContext.Provider value={{
      authLevel,
      userName,
      login,
      logout,
      isUser:  authLevel === 'user'  || authLevel === 'admin',
      isAdmin: authLevel === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

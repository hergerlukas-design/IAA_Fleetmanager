import { useState, type ReactNode } from 'react'
import { getStoredAuth, getStoredName, setStoredAuth, setStoredName, type AuthLevel } from '@/lib/auth'
import { AuthContext } from './useAuth'

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

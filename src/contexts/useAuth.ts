import { createContext, useContext } from 'react'
import type { AuthLevel } from '@/lib/auth'

export interface AuthContextValue {
  authLevel: AuthLevel
  userName: string
  login: (level: AuthLevel, name: string) => void
  logout: () => void
  isUser: boolean
  isAdmin: boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

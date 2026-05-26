export type AuthLevel = 'none' | 'user' | 'admin'

export function checkPin(pin: string): AuthLevel {
  const adminPin = import.meta.env.VITE_ADMIN_PIN
  const userPin  = import.meta.env.VITE_APP_PASSWORD
  if (pin && pin === adminPin) return 'admin'
  if (pin && pin === userPin)  return 'user'
  return 'none'
}

export function getStoredAuth(): AuthLevel {
  return (sessionStorage.getItem('clx_auth') as AuthLevel) ?? 'none'
}

export function setStoredAuth(level: AuthLevel): void {
  if (level === 'none') sessionStorage.removeItem('clx_auth')
  else sessionStorage.setItem('clx_auth', level)
}

export function getStoredName(): string {
  return sessionStorage.getItem('clx_name') ?? ''
}

export function setStoredName(name: string): void {
  sessionStorage.setItem('clx_name', name)
}

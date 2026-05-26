import type { ReactNode } from 'react'
import BottomNav from './BottomNav'

interface LayoutProps {
  children: ReactNode
  header?: ReactNode
}

export default function Layout({ children, header }: LayoutProps) {
  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col max-w-2xl mx-auto">
      {header && (
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
          {header}
        </header>
      )}
      <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}

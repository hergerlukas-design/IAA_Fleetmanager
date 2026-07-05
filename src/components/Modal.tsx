import type { ReactNode } from 'react'

interface Props {
  onClose: () => void
  children: ReactNode
  /** Extra classes for the panel (e.g. padding for form-only modals). */
  className?: string
  /** Whether a click on the backdrop closes the modal. Defaults to true. */
  closeOnBackdrop?: boolean
}

/**
 * Centered floating modal. On mobile the viewport meta
 * `interactive-widget=resizes-content` shrinks the viewport when the keyboard
 * opens, so `items-center` + `dvh` keep the panel above the keyboard.
 */
export default function Modal({ onClose, children, className = '', closeOnBackdrop = true }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={`w-full max-w-md bg-white rounded-3xl shadow-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto ${className}`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

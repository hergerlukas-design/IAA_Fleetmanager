import { useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  urls: string[]
  index: number
  onClose: () => void
  onNext?: () => void
  onPrev?: () => void
}

export default function ImageLightbox({ urls, index, onClose, onNext, onPrev }: Props) {
  const hasPrev = index > 0
  const hasNext = index < urls.length - 1
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && hasNext) onNext?.()
      if (e.key === 'ArrowLeft'  && hasPrev) onPrev?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onNext, onPrev, hasNext, hasPrev])

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 40) return
    if (dx < 0 && hasNext) onNext?.()
    if (dx > 0 && hasPrev) onPrev?.()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-10"
      >
        <X size={24} />
      </button>

      {hasPrev && (
        <button
          onClick={e => { e.stopPropagation(); onPrev?.() }}
          className="absolute left-0 top-0 h-full px-3 flex items-center text-white/60 hover:text-white"
        >
          <ChevronLeft size={32} />
        </button>
      )}

      <img
        src={urls[index]}
        alt=""
        className="max-w-full max-h-full object-contain select-none"
        onClick={e => e.stopPropagation()}
        draggable={false}
      />

      {hasNext && (
        <button
          onClick={e => { e.stopPropagation(); onNext?.() }}
          className="absolute right-0 top-0 h-full px-3 flex items-center text-white/60 hover:text-white"
        >
          <ChevronRight size={32} />
        </button>
      )}

      {urls.length > 1 && (
        <div className="absolute bottom-4 flex gap-1.5">
          {urls.map((_, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`} />
          ))}
        </div>
      )}
    </div>
  )
}

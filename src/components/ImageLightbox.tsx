import { useEffect } from 'react'
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && hasNext) onNext?.()
      if (e.key === 'ArrowLeft'  && hasPrev) onPrev?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onNext, onPrev, hasNext, hasPrev])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
      >
        <X size={24} />
      </button>

      {hasPrev && (
        <button
          onClick={e => { e.stopPropagation(); onPrev?.() }}
          className="absolute left-2 text-white/80 hover:text-white p-3"
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
          className="absolute right-2 text-white/80 hover:text-white p-3"
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

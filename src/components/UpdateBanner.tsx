import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'

interface UpdateBannerProps {
  onUpdate: () => void
}

export default function UpdateBanner({ onUpdate }: UpdateBannerProps) {
  const { t } = useTranslation()

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg">
      <span className="text-sm font-medium">{t('update.available')}</span>
      <button
        onClick={onUpdate}
        className="flex items-center gap-1.5 bg-white text-blue-600 text-sm font-semibold px-3 py-1 rounded-md active:scale-95 transition-transform"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        {t('update.reload')}
      </button>
    </div>
  )
}

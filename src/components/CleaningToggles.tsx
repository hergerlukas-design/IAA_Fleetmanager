import { useTranslation } from 'react-i18next'
import { Check, Droplets } from 'lucide-react'

type CleaningKind = 'inside' | 'outside'

function Pill({ active, label, disabled, onClick }: {
  active: boolean; label: string; disabled?: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 ${
        active
          ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
          : 'bg-white text-gray-500 border-gray-200 hover:border-emerald-300'
      }`}
    >
      {active ? <Check size={12} /> : <Droplets size={12} />}
      {label}
    </button>
  )
}

/** Reinigungs-Schalter (innen/außen). `showInside=false` blendet den Innen-Schalter aus (Trailer). */
export default function CleaningToggles({ inside, outside, showInside = true, disabled, onToggle }: {
  inside: boolean
  outside: boolean
  showInside?: boolean
  disabled?: boolean
  onToggle: (kind: CleaningKind, next: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] text-gray-400">{t('cleaning.label')}</span>
      {showInside && (
        <Pill active={inside} label={t('cleaning.inside')} disabled={disabled}
          onClick={() => onToggle('inside', !inside)} />
      )}
      <Pill active={outside} label={t('cleaning.outside')} disabled={disabled}
        onClick={() => onToggle('outside', !outside)} />
    </div>
  )
}

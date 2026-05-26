import { useTranslation } from 'react-i18next'

export default function LanguageToggle() {
  const { i18n } = useTranslation()
  const isDe = i18n.language.startsWith('de')

  return (
    <button
      onClick={() => i18n.changeLanguage(isDe ? 'en' : 'de')}
      className="text-xs font-semibold text-gray-500 hover:text-gray-800 px-2 py-1 rounded border border-gray-200 hover:border-gray-400 transition-colors"
    >
      {isDe ? 'EN' : 'DE'}
    </button>
  )
}

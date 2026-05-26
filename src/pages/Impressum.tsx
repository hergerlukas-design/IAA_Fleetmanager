import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'

function ImpressumDe() {
  return (
    <div className="px-4 py-6 space-y-6 text-sm text-gray-700">
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">Angaben gemäß § 5 TMG</h2>
        <p>Lukas Herger<br />Passauerstraße 26<br />81369 München</p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">Kontakt</h2>
        <p>
          Telefon: +49 160 3504039<br />
          E-Mail: <a href="mailto:herger.lukas@gmail.com" className="text-blue-600 underline">herger.lukas@gmail.com</a>
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
        <p>Lukas Herger<br />Passauerstraße 26<br />81369 München</p>
      </section>
    </div>
  )
}

function ImpressumEn() {
  return (
    <div className="px-4 py-6 space-y-6 text-sm text-gray-700">
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">Information Pursuant to § 5 TMG</h2>
        <p>Lukas Herger<br />Passauerstraße 26<br />81369 Munich, Germany</p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">Contact</h2>
        <p>
          Phone: +49 160 3504039<br />
          E-Mail: <a href="mailto:herger.lukas@gmail.com" className="text-blue-600 underline">herger.lukas@gmail.com</a>
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">Responsible for Content Pursuant to § 55 Abs. 2 RStV</h2>
        <p>Lukas Herger<br />Passauerstraße 26<br />81369 Munich, Germany</p>
      </section>
    </div>
  )
}

export default function Impressum() {
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const isEn = i18n.language?.startsWith('en')

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col max-w-2xl mx-auto">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-gray-500 hover:text-gray-800">
          <ArrowLeft size={22} />
        </button>
        <h1 className="font-bold text-gray-900">{isEn ? 'Legal Notice' : 'Impressum'}</h1>
      </header>
      {isEn ? <ImpressumEn /> : <ImpressumDe />}
    </div>
  )
}

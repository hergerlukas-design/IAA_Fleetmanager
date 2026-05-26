import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'

function DatenschutzDe() {
  return (
    <div className="px-4 py-6 space-y-6 text-sm text-gray-700">
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">1. Verantwortlicher</h2>
        <p>
          Lukas Herger<br />Passauerstraße 26, 81369 München<br />
          E-Mail: <a href="mailto:herger.lukas@gmail.com" className="text-blue-600 underline">herger.lukas@gmail.com</a>
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">2. Welche Daten werden verarbeitet</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Namen von Mitarbeitern</li>
          <li>Fahrzeugfotos und Schadensfotos</li>
          <li>Unterschriften (bei Annahmebestätigung)</li>
          <li>Standortangaben (Abholort)</li>
          <li>Kilometerstand und Fahrzeugdaten</li>
        </ul>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">3. Zweck der Verarbeitung</h2>
        <p>Interne Dokumentation von Fahrzeugannahmen und Flottenmanagement.</p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">4. Rechtsgrundlage</h2>
        <p>
          Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) für Unterschriften;
          Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse) für die interne Dokumentation.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">5. Speicherung &amp; Löschung</h2>
        <p>
          Daten werden auf Servern von Supabase (Irland / EU) gespeichert.
          Protokolle werden nach 3 Jahren gelöscht. Mit Supabase besteht ein Auftragsverarbeitungsvertrag (DPA).
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">6. Auftragsverarbeiter</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Supabase Inc. (Datenbank &amp; Dateispeicher) — DPA abgeschlossen</li>
          <li>Fly.io Inc. (Hosting) — DPA abgeschlossen</li>
        </ul>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">7. Rechte der betroffenen Personen</h2>
        <p>
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der
          Verarbeitung und Widerspruch gemäß Art. 15–21 DSGVO. Anfragen richten Sie bitte an:{' '}
          <a href="mailto:herger.lukas@gmail.com" className="text-blue-600 underline">herger.lukas@gmail.com</a>
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">8. Hinweis zur Unterschrift</h2>
        <p>
          Mit der geleisteten Unterschrift stimmt die unterzeichnende Person der Verarbeitung
          ihrer Unterschrift zum Zweck der Protokollierung der Fahrzeugannahme zu (Art. 6 Abs. 1 lit. b DSGVO).
        </p>
      </section>
    </div>
  )
}

function DatenschutzEn() {
  return (
    <div className="px-4 py-6 space-y-6 text-sm text-gray-700">
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">1. Controller</h2>
        <p>
          Lukas Herger<br />Passauerstraße 26, 81369 Munich, Germany<br />
          E-Mail: <a href="mailto:herger.lukas@gmail.com" className="text-blue-600 underline">herger.lukas@gmail.com</a>
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">2. What Data Is Processed</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Names of employees</li>
          <li>Vehicle photos and damage photos</li>
          <li>Signatures (during intake confirmation)</li>
          <li>Location data (pickup location)</li>
          <li>Mileage and vehicle data</li>
        </ul>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">3. Purpose of Processing</h2>
        <p>Internal documentation of vehicle intakes and fleet management.</p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">4. Legal Basis</h2>
        <p>
          Article 6 (1) lit. b GDPR (contract performance) for signatures;
          Article 6 (1) lit. f GDPR (legitimate interest) for internal documentation.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">5. Storage &amp; Deletion</h2>
        <p>
          Data is stored on Supabase servers (Ireland / EU).
          Records are deleted after 3 years. A Data Processing Agreement (DPA) exists with Supabase.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">6. Data Processors</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Supabase Inc. (Database &amp; File Storage) — DPA signed</li>
          <li>Fly.io Inc. (Hosting) — DPA signed</li>
        </ul>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">7. Rights of Data Subjects</h2>
        <p>
          You have the right to access, rectification, erasure, restriction of processing,
          and objection under Articles 15–21 GDPR. Please submit requests to:{' '}
          <a href="mailto:herger.lukas@gmail.com" className="text-blue-600 underline">herger.lukas@gmail.com</a>
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">8. Notice Regarding Signature</h2>
        <p>
          By providing a signature, the signing party consents to the processing of their
          signature for the purpose of documenting the vehicle intake (Article 6 (1) lit. b GDPR).
        </p>
      </section>
    </div>
  )
}

export default function Datenschutz() {
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const isEn = i18n.language?.startsWith('en')

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col max-w-2xl mx-auto">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-gray-500 hover:text-gray-800">
          <ArrowLeft size={22} />
        </button>
        <h1 className="font-bold text-gray-900">{isEn ? 'Privacy Policy' : 'Datenschutz'}</h1>
      </header>
      {isEn ? <DatenschutzEn /> : <DatenschutzDe />}
    </div>
  )
}

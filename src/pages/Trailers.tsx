import { useTranslation } from 'react-i18next'
import Layout from '@/components/Layout'
import TrailersPanel from './TrailersPanel'

export default function Trailers() {
  const { t } = useTranslation()
  return (
    <Layout
      header={
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">{t('trailers.title')}</h1>
          <img src="/logo.png" alt="carhandling" className="h-11 w-auto" />
        </div>
      }
    >
      <TrailersPanel />
    </Layout>
  )
}

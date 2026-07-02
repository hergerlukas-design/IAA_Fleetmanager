import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Root from './Root'
import './i18n/index'
import './index.css'

const container = document.getElementById('root')!
if (!container.hasAttribute('data-mounted')) {
  container.setAttribute('data-mounted', '')
  createRoot(container).render(
    <StrictMode>
      <Root />
    </StrictMode>
  )
}

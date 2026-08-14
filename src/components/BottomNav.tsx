import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Layers, Truck, ClipboardList, Settings } from 'lucide-react'

export default function BottomNav() {
  const { t } = useTranslation()

  const items = [
    { to: '/fleets',    icon: Layers,        label: t('nav.fleets')    },
    { to: '/vehicles',  icon: Truck,         label: t('nav.vehicles')  },
    { to: '/packliste', icon: ClipboardList, label: t('nav.packing')   },
    { to: '/settings',  icon: Settings,      label: t('nav.settings')  },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
              isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-700'
            }`
          }
        >
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

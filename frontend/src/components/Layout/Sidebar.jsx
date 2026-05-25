import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { to: '/',        icon: 'dashboard',    label: 'Vista General' },
  { to: '/dora',    icon: 'speed',        label: 'Métricas DORA' },
  { to: '/roadmap', icon: 'account_tree', label: 'Roadmap & Flujo' },
  { to: '/team',    icon: 'groups',       label: 'Salud del Equipo' },
]

export default function Sidebar({ isOpen, onClose }) {
  const { isAdmin, logout } = useAuth()

  return (
    <aside
      className={`
        h-screen w-64 fixed left-0 top-0 border-r border-outline-variant bg-surface flex flex-col py-1 shadow-sm z-50
        transform transition-transform duration-300
        md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      <div className="px-container-padding mb-8 mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-headline-md font-bold text-primary">Insights Ejecutivos</h1>
          <p className="text-body-base text-on-surface-variant">Suite de Salud Agile</p>
        </div>
        <button
          onClick={onClose}
          className="md:hidden w-11 h-11 flex items-center justify-center text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"
          aria-label="Cerrar menú"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <nav className="flex-grow space-y-1">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center px-container-padding py-3 transition-colors duration-200 ` +
              (isActive
                ? 'text-primary font-bold border-r-4 border-primary bg-secondary-container'
                : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high')
            }
          >
            <span className="material-symbols-outlined mr-3">{icon}</span>
            <span className="text-body-base">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-container-padding mt-auto pb-6 space-y-2">
        {isAdmin && (
          <NavLink
            to="/admin"
            onClick={onClose}
            className="block w-full py-2 text-center border border-outline text-on-surface-variant font-label-caps text-label-caps rounded-lg hover:bg-surface-container transition-colors"
          >
            Panel Admin
          </NavLink>
        )}
        <button
          onClick={logout}
          className="w-full py-2 bg-primary-container text-on-primary rounded-lg font-label-caps text-label-caps hover:opacity-90 transition-opacity"
        >
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}

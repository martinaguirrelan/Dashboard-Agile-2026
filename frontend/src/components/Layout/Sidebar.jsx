import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { T } from '../../theme'

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
      className={`h-screen w-64 fixed left-0 top-0 flex flex-col py-1 z-50 transform transition-transform duration-300 md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      style={{
        background: T.surface,
        borderRight: `1px solid ${T.border}`,
      }}
    >
      {/* Logo */}
      <div style={{ padding: '20px 24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: T.textPri, lineHeight: 1.2 }}>Insights Ejecutivos</h1>
          <p style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Suite de Salud Agile</p>
        </div>
        <button
          onClick={onClose}
          className="md:hidden"
          style={{ background: 'none', border: 'none', color: T.textSec, cursor: 'pointer', padding: 4 }}
          aria-label="Cerrar menú"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flexGrow: 1 }}>
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              padding: '11px 24px',
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? T.blue : T.textSec,
              background: isActive ? T.blueDim : 'transparent',
              borderRight: isActive ? `3px solid ${T.blue}` : '3px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s',
            })}
            onMouseEnter={(e) => { if (!e.currentTarget.dataset.active) e.currentTarget.style.color = T.textPri }}
            onMouseLeave={(e) => { if (!e.currentTarget.dataset.active) e.currentTarget.style.color = T.textSec }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, marginRight: 12 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
      <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isAdmin && (
          <NavLink
            to="/admin"
            onClick={onClose}
            style={{
              display: 'block',
              padding: '8px 0',
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.05em',
              color: T.textSec,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              textDecoration: 'none',
            }}
          >
            Panel Admin
          </NavLink>
        )}
        <button
          onClick={logout}
          style={{
            width: '100%',
            padding: '9px 0',
            background: T.blueDim,
            color: T.blue,
            border: `1px solid ${T.blue}`,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.05em',
            cursor: 'pointer',
          }}
        >
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}

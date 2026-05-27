import { useState, useRef, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { to: '/',        icon: 'dashboard',    label: 'Vista General' },
  { to: '/dora',    icon: 'speed',        label: 'Métricas DORA' },
  { to: '/roadmap', icon: 'account_tree', label: 'Roadmap & Flujo' },
  { to: '/team',    icon: 'groups',       label: 'Salud del Equipo' },
]

export default function TopBar() {
  const { isAdmin, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userOpen,   setUserOpen]   = useState(false)
  const userRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (userRef.current && !userRef.current.contains(e.target)) {
        setUserOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-outline-variant shadow-sm">
        <div className="flex items-center h-16 px-6 gap-6">

          {/* Logo */}
          <span className="text-lg font-bold tracking-tight text-primary whitespace-nowrap">
            Agile Health
          </span>

          <div className="hidden lg:block h-5 w-px bg-outline-variant" />

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1 flex-1">
            {NAV_ITEMS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-colors ` +
                  (isActive
                    ? 'text-primary bg-primary/[0.08]'
                    : 'text-on-surface-variant hover:text-primary hover:bg-primary/[0.05]')
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1 lg:flex-none" />

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary hover:text-primary cursor-pointer transition-colors text-xl">
              notifications
            </span>
            <span className="material-symbols-outlined text-secondary hover:text-primary cursor-pointer transition-colors text-xl">
              settings
            </span>

            {/* User dropdown */}
            <div className="relative" ref={userRef}>
              <button
                onClick={() => setUserOpen(!userOpen)}
                className="w-9 h-9 rounded-full bg-primary flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-white text-base">person</span>
              </button>

              {userOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-outline-variant rounded-xl shadow-lg py-1 z-50">
                  {isAdmin && (
                    <NavLink
                      to="/admin"
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-base text-secondary">admin_panel_settings</span>
                      Panel Admin
                    </NavLink>
                  )}
                  <div className="my-1 border-t border-outline-variant" />
                  <button
                    onClick={() => { logout(); setUserOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-error hover:bg-error/5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">logout</span>
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden w-9 h-9 flex items-center justify-center text-on-surface hover:bg-surface-container rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined">{mobileOpen ? 'close' : 'menu'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Nav Dropdown */}
        {mobileOpen && (
          <nav className="lg:hidden border-t border-outline-variant bg-white px-4 py-2 space-y-1">
            {NAV_ITEMS.map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ` +
                  (isActive
                    ? 'text-primary bg-primary/[0.08]'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container')
                }
              >
                <span className="material-symbols-outlined text-base">{icon}</span>
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
    </>
  )
}

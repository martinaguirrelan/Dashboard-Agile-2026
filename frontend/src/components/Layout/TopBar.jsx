import { useAuth } from '../../context/AuthContext'
import { T } from '../../theme'

export default function TopBar({ onMenuToggle }) {
  const { isAdmin } = useAuth()

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 40,
      background: T.surface,
      borderBottom: `1px solid ${T.border}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      height: 64,
      padding: '0 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={onMenuToggle}
          className="md:hidden"
          style={{
            width: 40, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none',
            color: T.textSec, cursor: 'pointer', borderRadius: 8,
          }}
          aria-label="Abrir menú"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <span style={{ fontSize: 20, fontWeight: 700, color: T.textPri, letterSpacing: '-0.01em' }}>
          Agile Health &amp; Roadmap
        </span>
        <div style={{ width: 1, height: 20, background: T.border }} className="hidden sm:block" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span className="material-symbols-outlined" style={{ color: T.textSec, cursor: 'pointer', fontSize: 22 }}>
            notifications
          </span>
          <span className="material-symbols-outlined" style={{ color: T.textSec, cursor: 'pointer', fontSize: 22 }}>
            settings
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: T.blueDim,
            border: `2px solid ${T.blue}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: T.blue }}>person</span>
          </div>
          {isAdmin && (
            <span className="hidden sm:inline" style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
              color: T.blue,
              background: T.blueDim,
              border: `1px solid ${T.blue}`,
              padding: '2px 10px',
              borderRadius: 20,
            }}>
              Admin
            </span>
          )}
        </div>
      </div>
    </header>
  )
}

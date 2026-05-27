import { useAuth } from '../../context/AuthContext'

export default function TopBar({ onMenuToggle }) {
  const { isAdmin } = useAuth()

  return (
    <header className="sticky top-0 z-40 bg-surface-bright border-b border-outline-variant flex justify-between items-center h-16 px-container-padding">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="md:hidden w-11 h-11 flex items-center justify-center text-on-surface hover:bg-surface-container rounded-lg transition-colors"
          aria-label="Abrir menú"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <span className="hidden sm:block text-headline-lg font-extrabold tracking-tight text-primary">
          Agile Health &amp; Roadmap
        </span>
        <span className="sm:hidden text-headline-md font-extrabold tracking-tight text-primary">
          Agile Health
        </span>
        <div className="hidden sm:block h-6 w-px bg-outline-variant mx-2" />
      </div>

      <div className="flex items-center gap-6">
        <div className="flex gap-4">
          <span className="material-symbols-outlined text-secondary hover:text-primary cursor-pointer transition-all">
            notifications
          </span>
          <span className="material-symbols-outlined text-secondary hover:text-primary cursor-pointer transition-all">
            settings
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full border-2 border-primary-container bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary text-base">person</span>
          </div>
          {isAdmin && (
            <span className="hidden sm:inline text-data-label font-data-label text-secondary bg-secondary-container px-2 py-0.5 rounded-full">
              Admin
            </span>
          )}
        </div>
      </div>
    </header>
  )
}

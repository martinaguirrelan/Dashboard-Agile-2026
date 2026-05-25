import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="bg-background text-on-background min-h-screen font-sans">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="md:ml-64 min-h-screen flex flex-col">
        <TopBar onMenuToggle={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 md:p-container-padding">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

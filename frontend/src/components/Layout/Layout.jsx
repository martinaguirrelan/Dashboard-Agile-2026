import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'

export default function Layout() {
  return (
    <div className="bg-white text-on-background min-h-screen font-sans">
      <TopBar />
      <main className="p-4 md:p-container-padding">
        <Outlet />
      </main>
    </div>
  )
}

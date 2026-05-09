import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function Layout() {
  return (
    <div className="bg-background text-on-background min-h-screen font-sans">
      <Sidebar />
      <div className="ml-64 min-h-screen flex flex-col">
        <TopBar />
        <main className="flex-1 p-container-padding">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

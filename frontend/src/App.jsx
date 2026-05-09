import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout/Layout'
import DashboardPage from './pages/DashboardPage'
import DoraMetricsPage from './pages/DoraMetricsPage'
import RoadmapPage from './pages/RoadmapPage'
import TeamHealthPage from './pages/TeamHealthPage'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'

function PrivateRoute({ children }) {
  const { isAdmin } = useAuth()
  const location = useLocation()
  if (!isAdmin) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route path="/"        element={<DashboardPage />} />
        <Route path="/dora"    element={<DoraMetricsPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/team"    element={<TeamHealthPage />} />
        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <AdminPage />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import { CapacityHeader } from '../components/capacity/Header'
import { CapacityKPIs } from '../components/capacity/KPIs'
import { CapacitySection } from '../components/capacity/CapacitySection'
import { ParentsSection } from '../components/capacity/ParentsSection'
import { ItemsSection } from '../components/capacity/ItemsSection'
import { AlertsSection } from '../components/capacity/AlertsSection'

const T = {
  bg: '#0b0d11',
  surface: '#14171c',
  border: '#1e2328',
  textPri: '#e2e8f0',
  textSec: '#8892a4',
  textMuted: '#556070',
  blue: '#3b82f6',
  green: '#22c55e',
  red: '#ef4444',
  amber: '#f59e0b',
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

function Loading() {
  return (
    <div style={{
      background: T.bg,
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <span className="material-symbols-outlined animate-spin" style={{ fontSize: 48, color: T.blue, display: 'block', marginBottom: 16 }}>
          refresh
        </span>
        <p style={{ fontSize: 14, color: T.textSec }}>Cargando dashboard...</p>
      </div>
    </div>
  )
}

function ErrorState({ error, onRetry }) {
  return (
    <div style={{
      background: T.bg,
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        textAlign: 'center',
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: '10px',
        padding: '40px',
        maxWidth: '400px',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: T.red, display: 'block', marginBottom: 16 }}>
          error
        </span>
        <p style={{ fontSize: 14, color: T.textPri, marginBottom: 8 }}>
          Error al cargar el dashboard
        </p>
        <p style={{ fontSize: 12, color: T.textSec, marginBottom: 20 }}>
          {error}
        </p>
        <button
          onClick={onRetry}
          style={{
            padding: '8px 16px',
            background: T.blue,
            color: T.textPri,
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}

export default function CapacityDashboardPage() {
  const { projectKey } = useParams()
  const [data, setData] = useState(null)
  const [sprints, setSprints] = useState([])
  const [selectedSprint, setSelectedSprint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch sprints list
  useEffect(() => {
    const fetchSprints = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/capacity/squad/${projectKey}/sprints`)
        setSprints(response.data.sprints || [])
        setSelectedSprint(response.data.sprints?.[response.data.sprints.length - 1]?.num || 4)
      } catch (err) {
        console.error('Error fetching sprints:', err)
        // Set default sprints if API call fails
        const defaultSprints = [
          { num: 1, name: 'Sprint 1', rango: '08/04 – 21/04' },
          { num: 2, name: 'Sprint 2', rango: '22/04 – 05/05' },
          { num: 3, name: 'Sprint 3', rango: '06/05 – 19/05' },
          { num: 4, name: 'Sprint 4', rango: '20/05 – 02/06' },
        ]
        setSprints(defaultSprints)
        setSelectedSprint(4)
      }
    }

    if (projectKey) {
      fetchSprints()
    }
  }, [projectKey])

  // Fetch dashboard data
  useEffect(() => {
    const fetchData = async () => {
      if (!projectKey || selectedSprint === null) {
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await axios.get(
          `${API_BASE_URL}/capacity/squad/${projectKey}`,
          { params: { sprint: selectedSprint } }
        )

        // API returns {data: {...}}, so extract the data wrapper
        setData(response.data.data || response.data)
      } catch (err) {
        console.error('Error fetching capacity data:', err)
        setError(err.response?.data?.detail || 'Error al cargar los datos del dashboard')
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(fetchData, 300)
    return () => clearTimeout(timer)
  }, [projectKey, selectedSprint])

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={() => setLoading(true)} />
  if (!data) return <ErrorState error="No hay datos disponibles" onRetry={() => setLoading(true)} />

  return (
    <div style={{
      background: T.bg,
      minHeight: '100vh',
      padding: '24px',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}>
        {/* Back link */}
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: T.textSec,
            fontSize: '13px',
            textDecoration: 'none',
            width: 'fit-content',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            arrow_back
          </span>
          Volver al Dashboard
        </Link>

        {/* Header */}
        <CapacityHeader
          squad={data.config}
          sprint={selectedSprint}
          sprints={sprints}
          onSprintChange={setSelectedSprint}
          loading={loading}
        />

        {/* KPIs */}
        <CapacityKPIs computed={data.computed} />

        {/* Main grid - Capacity + Alerts */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          '@media (max-width: 1024px)': {
            gridTemplateColumns: '1fr',
          },
        }}>
          <CapacitySection team={data.computed?.team || []} />
          <AlertsSection alerts={data.computed?.alertas || []} />
        </div>

        {/* Parents/Initiatives */}
        <ParentsSection parents={data.parents || []} />

        {/* Items */}
        <ItemsSection items={data.items || []} />
      </div>

      <style>{`
        @media (max-width: 1024px) {
          div[style*="gridTemplateColumns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

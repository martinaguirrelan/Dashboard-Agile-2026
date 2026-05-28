import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { getSquadCapacity, getSquadSprints } from '../api/capacity'
import { computeSprint, fmtHours, fmtDate, shortName, initials, todayISO } from '../utils/capacityUtils'
import '../styles/capacity.css'

function CapacityDashboardPage() {
  const { projectKey = 'TEST' } = useParams()
  const [sprint, setSprint] = useState(null)
  const [sprints, setSprints] = useState([])
  const [data, setData] = useState(null)
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load available sprints
  useEffect(() => {
    const loadSprints = async () => {
      try {
        const result = await getSquadSprints(projectKey)
        setSprints(result?.sprints || [])
        if (result?.sprints?.length > 0) {
          setSprint(result.sprints[0].num)
        }
      } catch (err) {
        setError('Error al cargar sprints: ' + err.message)
      }
    }
    loadSprints()
  }, [projectKey])

  // Load capacity data for selected sprint
  useEffect(() => {
    if (sprint === null) return

    const loadData = async () => {
      try {
        setLoading(true)
        const result = await getSquadCapacity(projectKey, sprint)
        setConfig(result?.CFG || {})
        setData(result?.D || {})
      } catch (err) {
        setError('Error al cargar datos: ' + err.message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [projectKey, sprint])

  // Compute sprint data
  const S = useMemo(() => {
    if (!data || !config || sprint === null) return null
    return computeSprint(data, config, sprint, false)
  }, [data, config, sprint])

  if (loading) return <LoadingState />
  if (error) return <ErrorState error={error} onRetry={() => window.location.reload()} />
  if (!S) return <ErrorState error="No data available" onRetry={() => window.location.reload()} />

  return (
    <div id="root">
      {/* Header */}
      <Header sprint={S} currentSprint={sprint} onSprintChange={setSprint} sprints={sprints} />

      {/* KPIs */}
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Avance Padres</div>
          <div className="kpi-value">{S.avancePadres.toFixed(1)}%</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Avance Horas</div>
          <div className="kpi-value">{S.avanceHoras.toFixed(1)}%</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Horas Esperadas</div>
          <div className="kpi-value">{Math.round((S.hTotalSec || 0) / 3600)}<span style={{fontSize: '14px'}}>h</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Items Cerrados</div>
          <div className="kpi-value">{S.padresDone}/{S.padresTotal}</div>
        </div>
        <div className="kpi warn">
          <div className="kpi-label">Alertas Críticas</div>
          <div className="kpi-value">{S.alertas?.filter(a => a.level === 'critico').length || 0}</div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid">
        {/* Left column - Capacity table */}
        <div className="card">
          <div className="card-head">
            <h3>Capacidad del Equipo</h3>
            <span className="hint">{S.team.length} personas</span>
          </div>
          <div className="cap-table">
            {S.team.map((member) => (
              <TeamRow key={member.name} member={member} />
            ))}
          </div>
        </div>

        {/* Right column - Alerts */}
        <div className="card">
          <div className="card-head">
            <h3>Alertas</h3>
          </div>
          {S.alertas && S.alertas.length > 0 ? (
            <div className="alerts-grid">
              {S.alertas.map((alert, idx) => (
                <AlertCard key={idx} alert={alert} />
              ))}
            </div>
          ) : (
            <div style={{textAlign: 'center', padding: '20px', color: 'var(--text-3)'}}>
              ✅ Sin alertas - Equipo en línea
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Header({ sprint, currentSprint, onSprintChange, sprints }) {
  return (
    <div className="hdr">
      <div className="hdr-titleblock">
        <div className="hdr-eyebrow">
          <span className="dot"></span>
          LIVE DASHBOARD
        </div>
        <h1 className="hdr-title">Capacidad & Equipo</h1>
        <div className="hdr-sub">
          <span>Sprint {currentSprint || '—'}</span>
          <span className="div">|</span>
          <span>{sprint?.pctEsperado || 0}% avance esperado</span>
        </div>
      </div>

      <div className="sprint-selector">
        <label className="sprint-selector-label">Sprint</label>
        <div className="sprint-selector-tabs">
          {sprints.map((s) => (
            <button
              key={s.num}
              className={`sprint-tab ${s.num === currentSprint ? 'active current' : ''}`}
              onClick={() => onSprintChange(s.num)}
            >
              {s.num}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function TeamRow({ member }) {
  const expPct = 100
  const realPct = Math.min(member.pctReal, 100)

  return (
    <div className={`cap-row lvl-${member.alertaLevel}`}>
      {/* Avatar */}
      <div className="avatar">{initials(member.name)}</div>

      {/* Name & role */}
      <div className="cap-person">
        <div className="cap-name">{shortName(member.name)}</div>
        {member.nota && <div className="cap-note">{member.nota}</div>}
      </div>

      {/* Capacity days */}
      <div className="cap-days">
        <small>Cap</small>
        {member.capDias}d
      </div>

      {/* Progress bars */}
      <div className="cap-progress">
        <div className="cap-progress-row">
          <div className="cap-progress-label">Esp</div>
          <div className="cap-progress-track">
            <div className="cap-progress-fill exp" style={{width: '100%'}}></div>
          </div>
        </div>
        <div className="cap-progress-row">
          <div className="cap-progress-label">Real</div>
          <div className="cap-progress-track">
            <div className={`cap-progress-fill real ${member.alertaLevel}`} style={{width: `${realPct}%`}}></div>
          </div>
          <div className="cap-progress-val">{member.pctReal.toFixed(0)}%</div>
        </div>
      </div>

      {/* Items bar */}
      <div className="cap-items">
        <div className="cap-items-numbers">
          <b>{member.itemCount}</b> items · <b>{fmtHours(member.estTotalSec)}</b>
        </div>
        <div className="cap-items-bar">
          <div className="seg done" style={{width: `${member.doneSec > 0 ? (member.doneSec / member.estTotalSec * 100) : 0}%`}}></div>
          <div className="seg proc" style={{width: `${(member.estTotalSec - member.doneSec) > 0 ? ((member.estTotalSec - member.doneSec) / member.estTotalSec * 100) : 0}%`}}></div>
        </div>
      </div>

      {/* Status badge */}
      <div className="cap-status">
        <div className={`cap-badge ${member.alertaLevel}`}>
          {member.alertaTitle}
        </div>
      </div>

      {/* Desviación */}
      <div className={`cap-desv ${member.alertaLevel}`}>
        {member.desv >= 0 ? '+' : ''}{member.desv.toFixed(1)}pp
      </div>
    </div>
  )
}

function AlertCard({ alert }) {
  return (
    <div className={`alert ${alert.level}`}>
      <div className="alert-head">
        <div className="alert-name">
          <div className="avatar" style={{width: '24px', height: '24px', fontSize: '10px'}}>
            {alert.name.split(' ').map(w => w[0]).join('')}
          </div>
          {alert.name}
        </div>
        <span className={`alert-title-badge ${alert.level}`}>{alert.title}</span>
      </div>
      <div className="alert-text">{alert.text}</div>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{
      background: 'var(--bg)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{textAlign: 'center', color: 'var(--text-2)'}}>
        <div style={{fontSize: '48px', marginBottom: '16px'}}>⏳</div>
        <p>Cargando dashboard...</p>
      </div>
    </div>
  )
}

function ErrorState({ error, onRetry }) {
  return (
    <div style={{
      background: 'var(--bg)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        textAlign: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '40px',
        maxWidth: '400px',
        color: 'var(--text)',
      }}>
        <div style={{fontSize: '48px', marginBottom: '16px'}}>❌</div>
        <p style={{marginBottom: '8px'}}>Error al cargar</p>
        <p style={{fontSize: '12px', color: 'var(--text-3)', marginBottom: '20px'}}>{error}</p>
        <button
          onClick={onRetry}
          style={{
            padding: '8px 16px',
            background: 'var(--accent)',
            color: '#0b0d11',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}

export default CapacityDashboardPage

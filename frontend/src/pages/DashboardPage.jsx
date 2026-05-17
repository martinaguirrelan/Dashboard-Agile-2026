import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getEpics, getEpicsStats, getProjects, getVps } from '../api/epics'
import { getSyncStatus, triggerSync } from '../api/sync'
import { useAuth } from '../context/AuthContext'
import { T } from '../theme'
import dayjs from 'dayjs'

// ── Helpers ────────────────────────────────────────────────────────────────

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
const YEARS    = ['2024', '2025', '2026', '2027']

const ESTADO_LABELS = {
  por_iniciar:   'Por Iniciar',
  en_desarrollo: 'En Desarrollo',
  en_pruebas:    'En Pruebas',
  en_revision:   'En Ratificación',
  en_prd:        'En Producción',
  finalizada:    'Finalizada',
}

// ── Shared dark-card ────────────────────────────────────────────────────────

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Filter Bar ──────────────────────────────────────────────────────────────

function SelectFilter({ label, value, onChange, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px', maxWidth: 200 }}>
      <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: T.textMuted, textTransform: 'uppercase' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%',
            padding: '9px 32px 9px 12px',
            background: T.surfaceHi,
            border: `1px solid ${T.borderHi}`,
            borderRadius: 8,
            color: value ? T.textPri : T.textSec,
            fontSize: 13,
            appearance: 'none',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {children}
        </select>
        <span className="material-symbols-outlined" style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          fontSize: 16, color: T.textMuted, pointerEvents: 'none',
        }}>
          expand_more
        </span>
      </div>
    </div>
  )
}

function FilterBar({ filters, vps, projects, onChange, onClear }) {
  const visibleSquads = filters.vp
    ? projects.filter((p) => p.vp === filters.vp)
    : projects

  function handleVpChange(v) {
    const squadStillValid = v === '' || projects.some((p) => p.project_key === filters.squad && p.vp === v)
    onChange({ ...filters, vp: v, squad: squadStillValid ? filters.squad : '' })
  }

  return (
    <Card style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: T.textMuted }}>filter_alt</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: T.textMuted, textTransform: 'uppercase' }}>
          Filtros Ejecutivos
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <SelectFilter label="VP" value={filters.vp} onChange={handleVpChange}>
          <option value="">Todas las VPs</option>
          {vps.map((vp) => <option key={vp} value={vp}>{vp}</option>)}
        </SelectFilter>

        <SelectFilter label="Squad" value={filters.squad} onChange={(v) => onChange({ ...filters, squad: v })}>
          <option value="">Todos los Squads</option>
          {visibleSquads.map((p) => (
            <option key={p.project_key} value={p.project_key}>{p.project_name || p.project_key}</option>
          ))}
        </SelectFilter>

        <SelectFilter label="Trimestre" value={filters.quarter} onChange={(v) => onChange({ ...filters, quarter: v })}>
          <option value="">Todos los trimestres</option>
          {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
        </SelectFilter>

        <SelectFilter label="Año" value={filters.year} onChange={(v) => onChange({ ...filters, year: v })}>
          <option value="">Todos los años</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </SelectFilter>

        <button
          onClick={onClear}
          style={{
            padding: '9px 16px',
            background: 'transparent',
            border: `1px solid ${T.borderHi}`,
            borderRadius: 8,
            color: T.textSec,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          Limpiar
        </button>
      </div>
    </Card>
  )
}

// ── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent = T.blue, icon }) {
  return (
    <Card style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: T.textSec, textTransform: 'uppercase' }}>
          {label}
        </span>
        {icon && (
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: T.textMuted }}>{icon}</span>
        )}
      </div>
      <p style={{ fontSize: 42, fontWeight: 700, lineHeight: 1, color: accent, letterSpacing: '-0.02em' }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 12, color: T.textMuted }}>{sub}</p>}
    </Card>
  )
}

// ── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ icon = 'inbox', message = 'No hay datos disponibles' }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', color: T.textMuted }}>
      <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 12, opacity: 0.4 }}>{icon}</span>
      <p style={{ fontSize: 14 }}>{message}</p>
    </div>
  )
}

// ── Initiatives Table ───────────────────────────────────────────────────────

function getSemaforo(epic) {
  const est = (epic.estado_iniciativa || '').toLowerCase().trim()
  if (est === 'cancelada' || est === 'en riesgo') return { label: 'CRÍTICO', color: T.red,   bg: T.redDim }
  if (epic.estado_normalizado === 'finalizada' || epic.estado_normalizado === 'en_prd')
    return { label: 'ÓPTIMO',  color: T.green, bg: T.greenDim }
  return { label: 'ATRASO',   color: T.amber, bg: T.amberDim }
}

function InitiativesTable({ epics }) {
  return (
    <Card>
      <div style={{
        padding: '16px 24px',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: T.blue }}>table_chart</span>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: T.textSec, textTransform: 'uppercase' }}>
            Detalle de Iniciativas
          </span>
        </div>
        <span style={{ fontSize: 12, color: T.textMuted }}>{epics.length} épicas</span>
      </div>

      {epics.length === 0 ? (
        <EmptyState icon="table_rows" message="No hay épicas. Ejecuta la sincronización desde el panel Admin." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#0f1215' }}>
                {['ÉPICA', 'ESTADO', 'ASSIGNEE', 'LEAD TIME', 'FECHA PRD', 'SEMÁFORO'].map((col) => (
                  <th key={col} style={{
                    padding: '10px 20px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    color: T.textMuted,
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {epics.map((epic) => {
                const sem = getSemaforo(epic)
                return (
                  <tr
                    key={epic.id}
                    style={{ borderTop: `1px solid ${T.border}`, borderLeft: `3px solid ${sem.color}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = T.surfaceHi }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '12px 20px', maxWidth: 320 }}>
                      <Link
                        to={`/squad/${epic.project_key}`}
                        style={{ color: T.textPri, fontWeight: 600, textDecoration: 'none' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = T.blue }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = T.textPri }}
                      >
                        {epic.epic_name}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 20px', color: T.textSec, whiteSpace: 'nowrap' }}>
                      {ESTADO_LABELS[epic.estado_normalizado] || epic.status || '—'}
                    </td>
                    <td style={{ padding: '12px 20px', color: T.textSec, whiteSpace: 'nowrap' }}>
                      {epic.assignee || '—'}
                    </td>
                    <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                      {epic.lead_time_days != null ? (
                        <span style={{ color: epic.lead_time_days > 30 ? T.red : T.textSec }}>
                          {epic.lead_time_days} días
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '12px 20px', color: T.textSec, whiteSpace: 'nowrap' }}>
                      {epic.fecha_prd ? dayjs(epic.fecha_prd).format('DD MMM YYYY') : '—'}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                        color: sem.color, background: sem.bg, border: `1px solid ${sem.color}`,
                      }}>
                        {sem.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { isAdmin, token } = useAuth()
  const [epics, setEpics]           = useState([])
  const [projects, setProjects]     = useState([])
  const [vps, setVps]               = useState([])
  const [loading, setLoading]       = useState(true)
  const [syncing, setSyncing]       = useState(false)
  const [filters, setFilters]       = useState({ vp: '', squad: '', quarter: '', year: '' })

  useEffect(() => {
    Promise.all([
      getEpics().catch(() => []),
      getEpicsStats().catch(() => null),
      getSyncStatus().catch(() => ({ projects: [] })),
      getProjects().catch(() => []),
      getVps().catch(() => []),
    ]).then(([epicsData, , , projectsData, vpsData]) => {
      setEpics(epicsData)
      setProjects(projectsData)
      setVps(vpsData)
    }).finally(() => setLoading(false))
  }, [])

  const filteredEpics = epics.filter((e) => {
    if (filters.squad && e.project_key !== filters.squad) return false
    if (filters.vp) {
      const proj = projects.find((p) => p.project_key === e.project_key)
      if (!proj || proj.vp !== filters.vp) return false
    }
    if (filters.quarter && String(e.quarter) !== filters.quarter) return false
    if (filters.year    && String(e.year)    !== filters.year)    return false
    return true
  })

  const handleSync = async () => {
    setSyncing(true)
    try {
      await triggerSync(token)
      const epicsData = await getEpics()
      setEpics(epicsData)
    } finally {
      setSyncing(false)
    }
  }

  const totalEpics = filteredEpics.length
  const hasEpics   = epics.length > 0
  const isFiltered = totalEpics !== epics.length

  const isCancelledOrAtRisk = (e) => {
    const est = (e.estado_iniciativa || '').toLowerCase().trim()
    return est === 'cancelada' || est === 'en riesgo'
  }

  const cancelledCount = filteredEpics.filter(isCancelledOrAtRisk).length
  const inProg = filteredEpics.filter(
    (e) => e.estado_normalizado === 'en_desarrollo' && !isCancelledOrAtRisk(e)
  ).length
  const DONE_STATUSES = ['finalizada', 'en_prd']
  const doneCount = filteredEpics.filter(
    (e) => DONE_STATUSES.includes(e.estado_normalizado) || e.fecha_done != null
  ).length
  const withLead = filteredEpics.filter((e) => e.lead_time_days != null)
  const avgLead = withLead.length
    ? Math.round(withLead.reduce((s, e) => s + e.lead_time_days, 0) / withLead.length)
    : null
  const icr = totalEpics > 0 ? Math.round((doneCount / totalEpics) * 100) : 0

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
        <span className="material-symbols-outlined animate-spin" style={{ fontSize: 40, color: T.blue }}>refresh</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1440, margin: '0 auto' }}>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        vps={vps}
        projects={projects}
        onChange={setFilters}
        onClear={() => setFilters({ vp: '', squad: '', quarter: '', year: '' })}
      />

      {/* Summary Header */}
      <Card style={{ padding: '24px 32px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', color: T.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>
              RESUMEN DE TRANSFORMACIÓN
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: T.textPri, lineHeight: 1.2 }}>
              Rendimiento del Portfolio — Épicas Activas
            </h2>
            {isFiltered && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                marginTop: 8, padding: '2px 10px', borderRadius: 20,
                fontSize: 11, fontWeight: 700,
                color: T.blue, background: T.blueDim, border: `1px solid ${T.blue}`,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>filter_alt</span>
                Filtro activo — {totalEpics} de {epics.length} épicas
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: T.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>CUMPLIMIENTO (ICR)</p>
              <p style={{ fontSize: 40, fontWeight: 700, color: T.blue, letterSpacing: '-0.02em' }}>{hasEpics ? `${icr}%` : '—'}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: T.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>ÉPICAS TOTALES</p>
              <p style={{ fontSize: 40, fontWeight: 700, color: T.blue, letterSpacing: '-0.02em' }}>{hasEpics ? totalEpics : '—'}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: T.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>ESTADO GENERAL</p>
              {hasEpics ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ color: T.green, fontSize: 24 }}>check_circle</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: T.green }}>Saludable</span>
                </div>
              ) : (
                <span style={{ fontSize: 14, color: T.textMuted }}>Sin datos</span>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={handleSync}
                disabled={syncing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 18px',
                  background: T.blueDim, color: T.blue,
                  border: `1px solid ${T.blue}`,
                  borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  opacity: syncing ? 0.6 : 1,
                }}
              >
                <span className={`material-symbols-outlined ${syncing ? 'animate-spin' : ''}`} style={{ fontSize: 16 }}>sync</span>
                {syncing ? 'Sincronizando…' : 'Sincronizar Jira'}
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* KPI Grid */}
      {hasEpics ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <KpiCard label="LEAD TIME PROMEDIO"        value={avgLead != null ? `${avgLead}d` : '—'} sub="Días promedio por épica"       icon="schedule"        accent={T.blue}  />
          <KpiCard label="EN DESARROLLO"             value={inProg}                                 sub="Activas este período"           icon="pending_actions" accent={T.amber} />
          <KpiCard label="CANCELADAS / EN RIESGO"   value={cancelledCount}                         sub="Requieren atención"             icon="warning"         accent={T.red}   />
          <KpiCard label="TERMINADAS"                value={doneCount}                              sub={`Ciclo completo — ${totalEpics} totales`} icon="task_alt" accent={T.green} />
          <KpiCard label="CUMPLIMIENTO ICR"          value={hasEpics ? `${icr}%` : '—'}            sub="Épicas completadas vs totales"  icon="percent"         accent={T.blue}  />
        </div>
      ) : (
        <Card>
          <EmptyState icon="bar_chart" message="No hay métricas disponibles. Sincroniza los datos de Jira para comenzar." />
        </Card>
      )}

      {/* Detail Table */}
      <InitiativesTable epics={filteredEpics} />

    </div>
  )
}

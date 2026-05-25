import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getEpics, getProjects } from '../api/epics'
import dayjs from 'dayjs'

// ── Theme tokens ──────────────────────────────────────────────────────────────

const T = {
  bg:         '#0b0d11',
  surface:    '#14171c',
  border:     '#1e2328',
  borderHigh: '#2a303a',
  textPri:    '#e2e8f0',
  textSec:    '#8892a4',
  textMuted:  '#556070',
  blue:       '#3b82f6',
  green:      '#22c55e',
  red:        '#ef4444',
  amber:      '#f59e0b',
  blueBg:     '#1e3a5f',
  greenBg:    '#14351f',
  redBg:      '#3b1212',
  amberBg:    '#3b2a0a',
}

// ── Semáforo helpers ──────────────────────────────────────────────────────────

function getSemaforo(epic) {
  const est = (epic.estado_iniciativa || '').toLowerCase().trim()
  if (est === 'cancelada' || est === 'en riesgo') return 'CRÍTICO'
  const en = epic.estado_normalizado
  if (en === 'finalizada' || en === 'en_prd') return 'ÓPTIMO'
  return 'ATRASO'
}

const SEMAFORO_STYLE = {
  CRÍTICO: { color: T.red,   bg: T.redBg,   border: T.red },
  ÓPTIMO:  { color: T.green, bg: T.greenBg, border: T.green },
  ATRASO:  { color: T.amber, bg: T.amberBg, border: T.amber },
}

const ESTADO_LABELS = {
  por_iniciar:   'Por Iniciar',
  en_desarrollo: 'En Desarrollo',
  en_pruebas:    'En Pruebas',
  en_revision:   'En Ratificación',
  en_prd:        'En Producción',
  finalizada:    'Finalizada',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DarkCard({ children, style = {} }) {
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

function KpiCard({ label, value, sub, accent = T.blue, icon }) {
  return (
    <DarkCard style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
      {sub && (
        <p style={{ fontSize: 12, color: T.textMuted }}>{sub}</p>
      )}
    </DarkCard>
  )
}

function SemaforoBadge({ value }) {
  const s = SEMAFORO_STYLE[value] || SEMAFORO_STYLE.ATRASO
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.05em',
      color: s.color,
      background: s.bg,
      border: `1px solid ${s.border}`,
    }}>
      {value}
    </span>
  )
}

function Loading() {
  return (
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="material-symbols-outlined animate-spin" style={{ fontSize: 40, color: T.blue }}>refresh</span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SquadDetailPage() {
  const { projectKey } = useParams()
  const [epics, setEpics]     = useState([])
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getEpics({ projectKey }),
      getProjects(),
    ]).then(([epicsData, projectsData]) => {
      setEpics(epicsData)
      const found = projectsData.find((p) => p.project_key === projectKey)
      setProject(found || { project_key: projectKey, project_name: projectKey, vp: '—' })
    }).finally(() => setLoading(false))
  }, [projectKey])

  if (loading) return <Loading />

  // ── KPI derivations ──
  const total = epics.length

  const isCancelledOrAtRisk = (e) => {
    const est = (e.estado_iniciativa || '').toLowerCase().trim()
    return est === 'cancelada' || est === 'en riesgo'
  }

  const enDesarrollo = epics.filter(
    (e) => e.estado_normalizado === 'en_desarrollo' && !isCancelledOrAtRisk(e)
  ).length

  const DONE_STATUSES = ['finalizada', 'en_prd']
  const terminadas = epics.filter(
    (e) => DONE_STATUSES.includes(e.estado_normalizado) || e.fecha_done != null
  ).length

  const canceladas = epics.filter(isCancelledOrAtRisk).length

  const withLead = epics.filter((e) => e.lead_time_days != null)
  const avgLead = withLead.length
    ? Math.round(withLead.reduce((s, e) => s + e.lead_time_days, 0) / withLead.length)
    : null

  const estadoGeneral = canceladas > 0 ? 'En Riesgo' : terminadas >= total * 0.7 ? 'Saludable' : 'En Curso'
  const estadoColor   = canceladas > 0 ? T.red      : terminadas >= total * 0.7 ? T.green     : T.amber

  const squadName = project?.project_name || projectKey

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '24px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Back link */}
        <Link
          to="/"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.textSec, fontSize: 13, textDecoration: 'none' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          Volver al Dashboard
        </Link>

        {/* ── SD-1 Header ─────────────────────────────────────────────────── */}
        <DarkCard style={{ padding: '28px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: T.textSec, textTransform: 'uppercase', marginBottom: 8 }}>
                SQUAD DETAIL
              </p>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: T.textPri, lineHeight: 1.2, marginBottom: 6 }}>
                {squadName}
              </h1>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: T.textSec }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>corporate_fare</span>
                  VP: <strong style={{ color: T.textPri, marginLeft: 4 }}>{project?.vp || '—'}</strong>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: T.textSec }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>key</span>
                  <strong style={{ color: T.textPri }}>{projectKey}</strong>
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: T.textSec, textTransform: 'uppercase', marginBottom: 6 }}>ÉPICAS TOTALES</p>
                <p style={{ fontSize: 36, fontWeight: 700, color: T.blue, letterSpacing: '-0.02em' }}>{total}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: T.textSec, textTransform: 'uppercase', marginBottom: 6 }}>ESTADO GENERAL</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: estadoColor }}>{estadoGeneral}</p>
              </div>
            </div>
          </div>
        </DarkCard>

        {/* ── SD-2 KPI Grid ────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <KpiCard label="ÉPICAS TOTALES"         value={total}      sub="En este squad"                        icon="layers"         accent={T.blue}  />
          <KpiCard label="EN DESARROLLO"          value={enDesarrollo} sub="Activas ahora"                     icon="pending_actions" accent={T.amber} />
          <KpiCard label="TERMINADAS"             value={terminadas} sub="Finalizadas o en PRD"                 icon="task_alt"        accent={T.green} />
          <KpiCard label="CANCELADAS / EN RIESGO" value={canceladas} sub="Requieren atención"                  icon="warning"         accent={T.red}   />
          <KpiCard label="LEAD TIME PROM."        value={avgLead != null ? `${avgLead}d` : '—'} sub="Días por épica" icon="schedule"   accent={T.blue}  />
        </div>

        {/* ── SD-3 Initiatives Table ──────────────────────────────────────── */}
        <DarkCard>
          {/* Table header */}
          <div style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: T.blue }}>table_chart</span>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: T.textSec, textTransform: 'uppercase' }}>
                DETALLE DE INICIATIVAS
              </span>
            </div>
            <span style={{ fontSize: 12, color: T.textMuted }}>{total} épicas</span>
          </div>

          {total === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: T.textMuted }}>
              <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 12, opacity: 0.4 }}>inbox</span>
              <p style={{ fontSize: 14 }}>No hay épicas para este squad.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0f1215' }}>
                    {['KEY', 'NOMBRE', 'ESTADO', 'SPRINT INICIO', 'ESTIMACIÓN', 'FECHA PRD', 'SEMÁFORO'].map((col) => (
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
                    const semStyle = SEMAFORO_STYLE[sem]
                    return (
                      <tr
                        key={epic.id}
                        style={{
                          borderTop: `1px solid ${T.border}`,
                          borderLeft: `3px solid ${semStyle.border}`,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#181c22' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <td style={{ padding: '12px 20px', color: T.blue, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {epic.jira_issue_id || epic.project_key}
                        </td>
                        <td style={{ padding: '12px 20px', color: T.textPri, fontWeight: 500, maxWidth: 320 }}>
                          <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {epic.epic_name}
                          </span>
                        </td>
                        <td style={{ padding: '12px 20px', color: T.textSec, whiteSpace: 'nowrap' }}>
                          {ESTADO_LABELS[epic.estado_normalizado] || epic.status || '—'}
                        </td>
                        <td style={{ padding: '12px 20px', color: T.textSec, whiteSpace: 'nowrap' }}>
                          {epic.sprint_inicio || '—'}
                        </td>
                        <td style={{ padding: '12px 20px', color: T.textSec, whiteSpace: 'nowrap' }}>
                          {epic.estimacion_inicial || '—'}
                        </td>
                        <td style={{ padding: '12px 20px', color: T.textSec, whiteSpace: 'nowrap' }}>
                          {epic.fecha_prd ? dayjs(epic.fecha_prd).format('DD MMM YYYY') : '—'}
                        </td>
                        <td style={{ padding: '12px 20px' }}>
                          <SemaforoBadge value={sem} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DarkCard>

      </div>
    </div>
  )
}

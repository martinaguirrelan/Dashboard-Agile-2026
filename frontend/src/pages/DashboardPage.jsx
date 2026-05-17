import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getEpics, getEpicsStats, getProjects, getVps } from '../api/epics'
import { getSyncStatus, triggerSync } from '../api/sync'
import { useAuth } from '../context/AuthContext'
import dayjs from 'dayjs'

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLUMNS = [
  { key: 'por_iniciar',   label: 'POR INICIAR',      accent: 'text-on-surface-variant', badge: 'bg-surface-container' },
  { key: 'en_desarrollo', label: 'EN DESARROLLO',    accent: 'text-primary',            badge: 'bg-primary-container text-on-primary' },
  { key: 'en_pruebas',    label: 'EN PRUEBAS',       accent: 'text-on-surface-variant', badge: 'bg-surface-container' },
  { key: 'en_revision',   label: 'EN RATIFICACIÓN',  accent: 'text-on-surface-variant', badge: 'bg-surface-container' },
  { key: 'finalizada',    label: 'FINALIZADAS',      accent: 'text-secondary',          badge: 'bg-green-100 text-green-700' },
]

function groupByStatus(epics) {
  return STATUS_COLUMNS.reduce((acc, col) => {
    acc[col.key] = epics.filter((e) => e.estado_normalizado === col.key)
    return acc
  }, {})
}

// ── Sub-components ─────────────────────────────────────────────────────────

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
const YEARS    = ['2024', '2025', '2026', '2027']

function EmptyState({ icon = 'inbox', message = 'No hay datos disponibles' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
      <span className="material-symbols-outlined text-5xl opacity-40">{icon}</span>
      <p className="text-body-base opacity-60">{message}</p>
    </div>
  )
}

function SelectFilter({ label, value, onChange, children }) {
  return (
    <div className="relative flex-1 min-w-[140px] max-w-[200px]">
      <label className="absolute -top-2 left-2 px-1 bg-white text-[10px] font-bold text-primary uppercase">
        {label}
      </label>
      <select
        className="w-full pl-3 pr-8 py-2 bg-white border border-outline-variant rounded-lg text-body-base text-on-surface appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-secondary pointer-events-none text-sm">
        expand_more
      </span>
    </div>
  )
}

function FilterBar({ filters, vps, projects, onChange, onClear }) {
  // Squads visibles: si hay VP seleccionada, solo los de esa VP
  const visibleSquads = filters.vp
    ? projects.filter((p) => p.vp === filters.vp)
    : projects

  function handleVpChange(v) {
    // Al cambiar VP, resetear squad si ya no pertenece a la nueva VP
    const squadStillValid = v === '' || projects.some((p) => p.project_key === filters.squad && p.vp === v)
    onChange({ ...filters, vp: v, squad: squadStillValid ? filters.squad : '' })
  }

  return (
    <div className="bg-white p-4 rounded border border-outline-variant shadow-card mb-2">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-secondary text-sm">filter_alt</span>
        <span className="text-label-caps text-secondary uppercase">Filtros Ejecutivos:</span>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
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
          className="min-h-[44px] px-4 py-2 border border-primary text-primary text-label-caps rounded-lg hover:bg-primary/5 transition-colors"
        >
          Limpiar Filtros
        </button>
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, icon, iconColor = 'text-on-surface-variant', children }) {
  return (
    <div className="bg-white p-6 rounded border border-outline-variant shadow-card flex flex-col">
      <div className="flex justify-between items-start mb-4 min-h-[4rem]">
        <span className="text-label-caps text-secondary">{label}</span>
        <span className={`material-symbols-outlined ${iconColor} cursor-help flex-shrink-0 ml-2`}>{icon || 'info'}</span>
      </div>
      <div className="mb-4">
        <p className="text-metric-display text-primary">{value}</p>
        {sub && <p className="text-data-label text-on-surface-variant mt-2">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

function EpicCard({ epic, isDone }) {
  const isOverdue = epic.due_date && dayjs(epic.due_date).isBefore(dayjs()) && epic.status !== 'Done'
  return (
    <div
      className={`bg-surface-container-lowest p-3 rounded border border-outline-variant
        hover:border-primary transition-colors cursor-pointer group
        ${isDone ? '' : 'border-l-4 border-l-primary'}`}
    >
      <p className="text-body-base font-bold text-primary mb-1 line-clamp-2">{epic.epic_name}</p>
      {epic.priority_status && (
        <div className="flex gap-1 mb-2">
          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded">
            {epic.priority_status}
          </span>
        </div>
      )}
      <div className="flex justify-between items-center">
        <span className="text-data-label text-secondary">{epic.project_key}</span>
        {epic.due_date && (
          <span className={`text-data-label ${isOverdue ? 'text-error font-bold' : 'text-secondary'}`}>
            {dayjs(epic.due_date).format('DD MMM')}
          </span>
        )}
      </div>
      {isDone && (
        <div className="flex justify-between items-start mt-1">
          <p className="text-data-label text-secondary">
            Completado {epic.updated_at ? dayjs(epic.updated_at).format('DD MMM') : '—'}
          </p>
          <span className="material-symbols-outlined text-green-600 text-sm">verified</span>
        </div>
      )}
    </div>
  )
}

function KanbanBoard({ grouped, hasData }) {
  return (
    <section className="bg-white p-6 rounded border border-outline-variant shadow-card">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-label-caps text-secondary mb-1">ESTADO DE LAS INICIATIVAS</h2>
          <p className="text-body-base text-on-surface-variant">Distribución actual del portfolio estratégico</p>
        </div>
        <button className="text-primary text-label-caps flex items-center gap-1 hover:underline">
          <span className="material-symbols-outlined text-sm">filter_list</span> Filtrar Vista
        </button>
      </div>

      {!hasData ? (
        <EmptyState icon="view_kanban" message="Sin épicas para mostrar. Ejecuta la sincronización con Jira." />
      ) : (
        <div className="flex flex-col md:flex-row gap-4 overflow-x-auto pb-2">
          {STATUS_COLUMNS.map((col) => {
            const items = grouped[col.key] || []
            const isDone = col.key === 'Done'
            return (
              <div key={col.key} className="flex flex-col gap-3 md:min-w-[180px] md:flex-1">
                <div className="flex items-center justify-between border-b border-outline-variant pb-2 mb-1">
                  <span className={`text-label-caps ${col.accent} uppercase`}>{col.label}</span>
                  <span className={`text-data-label ${col.badge} px-2 rounded-full`}>{items.length}</span>
                </div>
                <div
                  className={`max-h-[360px] overflow-y-auto space-y-3 pr-1 custom-scrollbar
                    ${isDone ? 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all' : ''}`}
                >
                  {items.length === 0 ? (
                    <p className="text-data-label text-on-surface-variant text-center py-4">Sin épicas</p>
                  ) : (
                    items.map((epic) => <EpicCard key={epic.id} epic={epic} isDone={isDone} />)
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

const ESTADO_LABELS = {
  por_iniciar:  'Por Iniciar',
  en_desarrollo: 'En Desarrollo',
  en_pruebas:   'En Pruebas',
  en_revision:  'En Ratificación',
  en_prd:       'En Producción',
  finalizada:   'Finalizada',
}

function InitiativesTable({ epics }) {
  return (
    <section className="bg-white rounded border border-outline-variant shadow-card overflow-hidden">
      <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary">table_chart</span>
          <h2 className="text-label-caps text-primary">DETALLE DE INICIATIVAS</h2>
        </div>
        <span className="text-data-label text-on-surface-variant">{epics.length} épicas totales</span>
      </div>

      {epics.length === 0 ? (
        <EmptyState icon="table_rows" message="No hay épicas sincronizadas aún. Ejecuta la sincronización desde el panel Admin." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-lowest">
                {[
                  { label: 'ÉPICA',              cls: '' },
                  { label: 'ESTADO',             cls: '' },
                  { label: 'ASSIGNEE',           cls: 'hidden md:table-cell' },
                  { label: 'LEAD TIME',          cls: 'hidden sm:table-cell' },
                  { label: 'FECHA PASE A PRD',   cls: 'hidden md:table-cell' },
                ].map(({ label, cls }) => (
                  <th key={label} className={`px-6 py-4 text-label-caps text-secondary ${cls}`}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {epics.map((epic) => {
                const isOverdue = epic.due_date && dayjs(epic.due_date).isBefore(dayjs()) && epic.status !== 'Done'
                return (
                  <tr key={epic.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full flex-shrink-0 ${isOverdue ? 'bg-error' : 'bg-primary'}`} />
                        <Link
                          to={`/squad/${epic.project_key}`}
                          className="text-body-base font-bold text-primary hover:underline"
                        >
                          {epic.epic_name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-body-base text-on-surface-variant">
                      {ESTADO_LABELS[epic.estado_normalizado] || epic.status || '—'}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 text-body-base text-on-surface-variant">{epic.assignee || '—'}</td>
                    <td className="hidden sm:table-cell px-6 py-4 text-body-base">
                      {epic.lead_time_days != null ? (
                        <span className={epic.lead_time_days > 30 ? 'text-error font-bold' : 'text-on-surface'}>
                          {epic.lead_time_days} días
                        </span>
                      ) : '—'}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 text-body-base text-on-surface-variant">
                      {epic.fecha_prd ? dayjs(epic.fecha_prd).format('DD MMM YYYY') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { isAdmin, token } = useAuth()
  const [epics, setEpics]           = useState([])
  const [stats, setStats]           = useState(null)
  const [syncStatus, setSyncStatus] = useState(null)
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
    ]).then(([epicsData, statsData, syncData, projectsData, vpsData]) => {
      setEpics(epicsData)
      setStats(statsData)
      setSyncStatus(syncData)
      setProjects(projectsData)
      setVps(vpsData)
    }).finally(() => setLoading(false))
  }, [])

  // VP filtra por el campo vp del proyecto; Squad por project_key; año/quarter por campos ETL
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

  const grouped = groupByStatus(filteredEpics)

  const handleSync = async () => {
    setSyncing(true)
    try {
      await triggerSync(token)
      const [epicsData, statsData, syncData] = await Promise.all([
        getEpics(), getEpicsStats(), getSyncStatus(),
      ])
      setEpics(epicsData)
      setStats(statsData)
      setSyncStatus(syncData)
    } finally {
      setSyncing(false)
    }
  }

  const totalEpics = filteredEpics.length
  const hasEpics   = epics.length > 0
  const isFiltered = totalEpics !== epics.length

  const avgLead = (() => {
    const withLead = filteredEpics.filter((e) => e.lead_time_days != null)
    if (!withLead.length) return null
    return Math.round(withLead.reduce((s, e) => s + e.lead_time_days, 0) / withLead.length)
  })()

  // HU KPIs: cancelada/en riesgo prevalece sobre cualquier otro estado
  const isCancelledOrAtRisk = (e) => {
    const est = (e.estado_iniciativa || '').toLowerCase().trim()
    return est === 'cancelada' || est === 'en riesgo'
  }

  const cancelledCount = filteredEpics.filter(isCancelledOrAtRisk).length

  const inProg = filteredEpics.filter(
    (e) => e.estado_normalizado === 'en_desarrollo' && !isCancelledOrAtRisk(e)
  ).length

  // Terminadas: finalizada + en_prd cuentan como terminadas, o si tiene fecha_done
  const DONE_STATUSES = ['finalizada', 'en_prd']
  const doneCount = filteredEpics.filter(
    (e) => DONE_STATUSES.includes(e.estado_normalizado) || e.fecha_done != null
  ).length

  const blockedCount = filteredEpics.filter((e) =>
    e.status === 'Blocked' || e.status === 'On Hold' || e.status === 'Bloqueado'
  ).length

  const icr = totalEpics > 0 ? Math.round((doneCount / totalEpics) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">refresh</span>
      </div>
    )
  }

  return (
    <div className="space-y-card-gap max-w-[1440px] mx-auto">

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        vps={vps}
        projects={projects}
        onChange={setFilters}
        onClear={() => setFilters({ vp: '', squad: '', quarter: '', year: '' })}
      />

      {/* Summary Header */}
      <section>
        <div className="bg-white p-6 rounded border border-outline-variant shadow-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-label-caps text-secondary mb-1">RESUMEN DE TRANSFORMACIÓN</h2>
            <h3 className="text-headline-lg text-primary">Rendimiento del Portfolio — Épicas Activas</h3>
            {isFiltered && (
              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-primary-container text-on-primary text-[10px] font-bold rounded-full">
                <span className="material-symbols-outlined text-[12px]">filter_alt</span>
                Filtro activo — {totalEpics} de {epics.length} épicas
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-6 sm:gap-12 items-center">
            <div className="text-center">
              <p className="text-label-caps text-on-surface-variant">CUMPLIMIENTO (ICR)</p>
              <p className="text-metric-display text-primary">{hasEpics ? `${icr}%` : '—'}</p>
            </div>
            <div className="text-center">
              <p className="text-label-caps text-on-surface-variant">ÉPICAS TOTALES</p>
              <p className="text-metric-display text-primary">{hasEpics ? totalEpics : '—'}</p>
            </div>
            <div className="text-center">
              <p className="text-label-caps text-on-surface-variant mb-2">ESTADO GENERAL</p>
              {hasEpics ? (
                <div className="flex items-center justify-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <span className="material-symbols-outlined text-green-700" style={{ fontVariationSettings: '"FILL" 1' }}>
                      check_circle
                    </span>
                  </span>
                  <span className="ml-3 text-headline-md text-green-700">Saludable</span>
                </div>
              ) : (
                <span className="text-body-base text-on-surface-variant">Sin datos</span>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary rounded-lg text-label-caps hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-sm ${syncing ? 'animate-spin' : ''}`}>sync</span>
                {syncing ? 'Sincronizando…' : 'Sincronizar Jira'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* KPI Grid — solo se renderiza si hay datos */}
      {hasEpics ? (
        <section className="grid gap-card-gap grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard label="LEAD TIME PROMEDIO" value={avgLead != null ? `${avgLead}` : '—'} sub="días promedio por épica">
            <div className="h-20 w-full bg-slate-50 flex items-end gap-1 px-1 mt-4">
              {[40, 60, 50, 70, 35, 30].map((h, i) => (
                <div key={i} className="w-full bg-primary-container rounded-t" style={{ height: `${h}%` }} />
              ))}
            </div>
          </KpiCard>

          <KpiCard label="ÉPICAS EN DESARROLLO" value={inProg} sub="Activas este período">
          </KpiCard>

          <KpiCard
            label="ÉPICAS CANCELADAS / EN RIESGO"
            value={cancelledCount}
            sub="Filtro de eficiencia activo"
            iconColor="text-error"
          >
            <div className="mt-10 relative h-2 bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-error"
                style={{ width: `${Math.min(100, (cancelledCount / Math.max(1, totalEpics)) * 100)}%` }}
              />
            </div>
          </KpiCard>

          <KpiCard label="ÉPICAS BLOQUEADAS" value={blockedCount} sub="Optimización de capacidad">
            <div className="mt-6 flex items-center justify-between">
              <span className="text-data-label text-on-surface-variant">Revisado por Comité Agile</span>
            </div>
          </KpiCard>

          <KpiCard label="ÉPICAS TERMINADAS" value={doneCount} sub={`Ciclo completo — ${totalEpics} totales`}>
            <div className="mt-8 flex items-center gap-2">
              <span className="material-symbols-outlined text-green-700">emoji_events</span>
              <span className="text-data-label text-green-700 uppercase font-bold">
                {doneCount > 0 ? 'Meta en curso' : 'Sin completadas'}
              </span>
            </div>
          </KpiCard>
        </section>
      ) : (
        <section className="bg-white rounded border border-outline-variant shadow-card">
          <EmptyState icon="bar_chart" message="No hay métricas disponibles. Sincroniza los datos de Jira para comenzar." />
        </section>
      )}

      {/* Detail Table */}
      <InitiativesTable epics={filteredEpics} />

    </div>
  )
}


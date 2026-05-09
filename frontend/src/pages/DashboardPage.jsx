import { useState, useEffect } from 'react'
import { getEpics, getEpicsStats } from '../api/epics'
import { getSyncStatus, triggerSync } from '../api/sync'
import { useAuth } from '../context/AuthContext'
import dayjs from 'dayjs'

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLUMNS = [
  { key: 'To Do',        label: 'POR INICIAR',      accent: 'text-on-surface-variant', badge: 'bg-surface-container' },
  { key: 'In Progress',  label: 'EN DESARROLLO',    accent: 'text-primary',            badge: 'bg-primary-container text-on-primary' },
  { key: 'In Testing',   label: 'EN PRUEBAS',       accent: 'text-on-surface-variant', badge: 'bg-surface-container' },
  { key: 'In Review',    label: 'EN RATIFICACIÓN',  accent: 'text-on-surface-variant', badge: 'bg-surface-container' },
  { key: 'Done',         label: 'FINALIZADAS',      accent: 'text-secondary',          badge: 'bg-green-100 text-green-700' },
]

function groupByStatus(epics) {
  return STATUS_COLUMNS.reduce((acc, col) => {
    acc[col.key] = epics.filter((e) => e.status === col.key)
    return acc
  }, {})
}

// ── Sub-components ─────────────────────────────────────────────────────────

function FilterBar({ filters, onChange, onClear }) {
  return (
    <div className="bg-white p-4 rounded border border-outline-variant shadow-card flex items-center gap-6 mb-2">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-secondary text-sm">filter_alt</span>
        <span className="text-label-caps text-secondary uppercase">Filtros Ejecutivos:</span>
      </div>
      <div className="flex flex-wrap gap-4 flex-grow">
        <div className="relative flex-1 max-w-[200px]">
          <label className="absolute -top-2 left-2 px-1 bg-white text-[10px] font-bold text-primary uppercase">
            Estado
          </label>
          <select
            className="w-full pl-3 pr-8 py-2 bg-white border border-outline-variant rounded-lg text-body-base text-on-surface appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            value={filters.status}
            onChange={(e) => onChange({ ...filters, status: e.target.value })}
          >
            <option value="">Todos los estados</option>
            {STATUS_COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-secondary pointer-events-none text-sm">
            expand_more
          </span>
        </div>
        <div className="relative flex-1 max-w-[200px]">
          <label className="absolute -top-2 left-2 px-1 bg-white text-[10px] font-bold text-primary uppercase">
            Proyecto
          </label>
          <select
            className="w-full pl-3 pr-8 py-2 bg-white border border-outline-variant rounded-lg text-body-base text-on-surface appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            value={filters.projectKey}
            onChange={(e) => onChange({ ...filters, projectKey: e.target.value })}
          >
            <option value="">Todos los proyectos</option>
            {filters._projects.map((p) => (
              <option key={p.key} value={p.key}>{p.name || p.key}</option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-secondary pointer-events-none text-sm">
            expand_more
          </span>
        </div>
      </div>
      <button
        onClick={onClear}
        className="px-4 py-2 border border-primary text-primary text-label-caps rounded-lg hover:bg-primary/5 transition-colors"
      >
        Limpiar Filtros
      </button>
    </div>
  )
}

function KpiCard({ label, value, sub, icon, iconColor = 'text-on-surface-variant', children }) {
  return (
    <div className="bg-white p-6 rounded border border-outline-variant shadow-card">
      <div className="flex justify-between items-start mb-4">
        <span className="text-label-caps text-secondary">{label}</span>
        <span className={`material-symbols-outlined ${iconColor} cursor-help`}>{icon || 'info'}</span>
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

function KanbanBoard({ grouped }) {
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

      <div className="grid grid-cols-5 gap-4">
        {STATUS_COLUMNS.map((col) => {
          const items = grouped[col.key] || []
          const isDone = col.key === 'Done'
          return (
            <div key={col.key} className="flex flex-col gap-3">
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
    </section>
  )
}

function InitiativesTable({ epics }) {
  const filtered = epics.filter((e) => e.lead_time_days !== null && e.lead_time_days > 30)
  return (
    <section className="bg-white rounded border border-outline-variant shadow-card overflow-hidden">
      <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary">table_chart</span>
          <h2 className="text-label-caps text-primary">DETALLE DE INICIATIVAS</h2>
        </div>
        <span className="text-data-label text-on-surface-variant">{epics.length} épicas totales</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-lowest">
              {['ÉPICA', 'PROYECTO', 'ESTADO', 'ASSIGNEE', 'LEAD TIME', 'VENCE'].map((h) => (
                <th key={h} className="px-6 py-4 text-label-caps text-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {epics.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-body-base text-on-surface-variant">
                  No hay épicas sincronizadas aún. Ejecuta la sincronización desde el panel Admin.
                </td>
              </tr>
            ) : (
              epics.map((epic) => {
                const isOverdue = epic.due_date && dayjs(epic.due_date).isBefore(dayjs()) && epic.status !== 'Done'
                return (
                  <tr key={epic.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${isOverdue ? 'bg-error' : 'bg-primary'}`} />
                        <span className="text-body-base font-bold text-primary">{epic.epic_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-body-base text-secondary">{epic.project_key}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold
                        ${epic.status === 'Done'
                          ? 'bg-green-100 text-green-700'
                          : epic.status === 'In Progress'
                          ? 'bg-primary-container text-on-primary'
                          : 'bg-surface-container text-on-surface-variant'}`}>
                        {epic.status || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-body-base text-on-surface-variant">{epic.assignee || '—'}</td>
                    <td className="px-6 py-4 text-body-base">
                      {epic.lead_time_days != null ? (
                        <span className={epic.lead_time_days > 30 ? 'text-error font-bold' : 'text-on-surface'}>
                          {epic.lead_time_days} días
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 text-body-base text-on-surface-variant">
                      {epic.due_date ? (
                        <span className={isOverdue ? 'text-error font-bold' : ''}>
                          {dayjs(epic.due_date).format('DD MMM YYYY')}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { isAdmin, token } = useAuth()
  const [epics, setEpics]     = useState([])
  const [stats, setStats]     = useState(null)
  const [syncStatus, setSyncStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [filters, setFilters] = useState({ status: '', projectKey: '', _projects: [] })

  useEffect(() => {
    Promise.all([getEpics(), getEpicsStats(), getSyncStatus()])
      .then(([epicsData, statsData, syncData]) => {
        setEpics(epicsData)
        setStats(statsData)
        setSyncStatus(syncData)
        setFilters((f) => ({ ...f, _projects: syncData.projects || [] }))
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredEpics = epics.filter((e) => {
    if (filters.status && e.status !== filters.status) return false
    if (filters.projectKey && e.project_key !== filters.projectKey) return false
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

  const totalEpics  = stats?.total ?? 0
  const doneCount   = grouped['Done']?.length ?? 0
  const inProg      = grouped['In Progress']?.length ?? 0
  const avgLead     = stats?.avg_lead_time_days ?? null
  const icr         = totalEpics > 0 ? Math.round((doneCount / totalEpics) * 100) : 0

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
        onChange={setFilters}
        onClear={() => setFilters((f) => ({ ...f, status: '', projectKey: '' }))}
      />

      {/* Summary Header */}
      <section>
        <div className="bg-white p-6 rounded border border-outline-variant shadow-card flex items-center justify-between">
          <div>
            <h2 className="text-label-caps text-secondary mb-1">RESUMEN DE TRANSFORMACIÓN</h2>
            <h3 className="text-headline-lg text-primary">Rendimiento del Portfolio — Épicas Activas</h3>
          </div>
          <div className="flex gap-12 items-center">
            <div className="text-center">
              <p className="text-label-caps text-on-surface-variant">CUMPLIMIENTO (ICR)</p>
              <p className="text-metric-display text-primary">{icr}%</p>
            </div>
            <div className="text-center">
              <p className="text-label-caps text-on-surface-variant">ÉPICAS TOTALES</p>
              <p className="text-metric-display text-primary">{totalEpics}</p>
            </div>
            <div className="text-center">
              <p className="text-label-caps text-on-surface-variant mb-2">ESTADO GENERAL</p>
              <div className="flex items-center justify-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <span className="material-symbols-outlined text-green-700" style={{ fontVariationSettings: '"FILL" 1' }}>
                    check_circle
                  </span>
                </span>
                <span className="ml-3 text-headline-md text-green-700">Saludable</span>
              </div>
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

      {/* KPI Grid */}
      <section className="grid gap-card-gap grid-cols-5">
        <KpiCard label="LEAD TIME PROMEDIO" value={avgLead != null ? `${avgLead}` : '—'} sub="días promedio por épica">
          <div className="h-20 w-full bg-slate-50 flex items-end gap-1 px-1 mt-4">
            {[40, 60, 50, 70, 35, 30].map((h, i) => (
              <div key={i} className="w-full bg-primary-container rounded-t" style={{ height: `${h}%` }} />
            ))}
          </div>
        </KpiCard>

        <KpiCard
          label="ÉPICAS EN DESARROLLO"
          value={inProg}
          sub="Activas este período"
        >
          <div className="mt-8 pt-4 border-t border-outline-variant">
            <p className="text-data-label text-on-surface-variant">
              {syncStatus?.projects?.length ?? 0} proyectos activos
            </p>
          </div>
        </KpiCard>

        <KpiCard
          label="ÉPICAS CANCELADAS / EN RIESGO"
          value={stats?.by_status?.Cancelled ?? 0}
          sub="Filtro de eficiencia activo"
          iconColor="text-error"
        >
          <div className="mt-10 relative h-2 bg-surface-container-high rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-error"
              style={{ width: `${Math.min(100, ((stats?.by_status?.Cancelled ?? 0) / Math.max(1, totalEpics)) * 100)}%` }}
            />
          </div>
        </KpiCard>

        <KpiCard
          label="ÉPICAS BLOQUEADAS"
          value={stats?.by_status?.Blocked ?? stats?.by_status?.['On Hold'] ?? 0}
          sub="Optimización de capacidad"
        >
          <div className="mt-6 flex items-center justify-between">
            <span className="text-data-label text-on-surface-variant">Revisado por Comité Agile</span>
          </div>
        </KpiCard>

        <KpiCard label="ÉPICAS TERMINADAS" value={doneCount} sub={`Ciclo completo — ${epics.length} totales`}>
          <div className="mt-8 flex items-center gap-2">
            <span className="material-symbols-outlined text-green-700">emoji_events</span>
            <span className="text-data-label text-green-700 uppercase font-bold">
              {doneCount > 0 ? 'Meta en curso' : 'Sin completadas'}
            </span>
          </div>
        </KpiCard>
      </section>

      {/* Kanban Board */}
      <KanbanBoard grouped={grouped} />

      {/* Detail Table */}
      <InitiativesTable epics={filteredEpics} />

    </div>
  )
}

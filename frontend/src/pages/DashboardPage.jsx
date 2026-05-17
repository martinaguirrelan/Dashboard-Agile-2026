import { useState, useEffect } from 'react'
import { getEpics, getProjects, getVps } from '../api/epics'
import { getSyncStatus, triggerSync } from '../api/sync'
import { useAuth } from '../context/AuthContext'
import dayjs from 'dayjs'

// ── Constants ──────────────────────────────────────────────────────────────

const QUARTERS    = ['Q1', 'Q2', 'Q3', 'Q4']
const YEARS       = ['2024', '2025', '2026', '2027']
const DONE_STATUSES = ['finalizada', 'en_prd']

const ESTADO_LABELS = {
  por_iniciar:   'Por Iniciar',
  en_desarrollo: 'En Desarrollo',
  en_pruebas:    'En Pruebas',
  en_revision:   'En Ratificación',
  en_prd:        'En Producción',
  finalizada:    'Finalizada',
}

const ESTADO_DOT = {
  por_iniciar:   'bg-slate-400',
  en_desarrollo: 'bg-blue-500',
  en_pruebas:    'bg-amber-500',
  en_revision:   'bg-purple-500',
  en_prd:        'bg-green-500',
  finalizada:    'bg-green-600',
}

const ESTADO_TEXT = {
  por_iniciar:   'text-slate-500',
  en_desarrollo: 'text-blue-600',
  en_pruebas:    'text-amber-600',
  en_revision:   'text-purple-600',
  en_prd:        'text-green-600',
  finalizada:    'text-green-700',
}

// ── Helpers ────────────────────────────────────────────────────────────────

const isCancelledOrAtRisk = (e) => {
  const v = (e.estado_iniciativa || '').toLowerCase().trim()
  return v === 'cancelada' || v === 'en riesgo'
}

// ── Filter Bar ─────────────────────────────────────────────────────────────

function FilterBar({ filters, vps, projects, onChange, onClear, onSync, syncing, isAdmin }) {
  const visibleSquads = filters.vp ? projects.filter(p => p.vp === filters.vp) : projects

  function handleVpChange(v) {
    const valid = v === '' || projects.some(p => p.project_key === filters.squad && p.vp === v)
    onChange({ ...filters, vp: v, squad: valid ? filters.squad : '' })
  }

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="bg-white border-b border-outline-variant px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-2 sticky top-0 z-10 shadow-sm">

      {/* Icon */}
      <span className="material-symbols-outlined text-secondary text-base hidden sm:block">filter_alt</span>

      {/* Selects */}
      {[
        {
          value: filters.vp,
          onChange: handleVpChange,
          placeholder: 'VP',
          options: vps.map(v => ({ value: v, label: v })),
        },
        {
          value: filters.squad,
          onChange: v => onChange({ ...filters, squad: v }),
          placeholder: 'Squad',
          options: visibleSquads.map(p => ({ value: p.project_key, label: p.project_name || p.project_key })),
        },
        {
          value: filters.quarter,
          onChange: v => onChange({ ...filters, quarter: v }),
          placeholder: 'Trimestre',
          options: QUARTERS.map(q => ({ value: q, label: q })),
        },
        {
          value: filters.year,
          onChange: v => onChange({ ...filters, year: v }),
          placeholder: 'Año',
          options: YEARS.map(y => ({ value: y, label: y })),
        },
      ].map(({ value, onChange: onC, placeholder, options }) => (
        <select
          key={placeholder}
          value={value}
          onChange={e => onC(e.target.value)}
          className="h-8 px-2 pr-7 text-sm border border-outline-variant rounded-md bg-white text-on-surface
                     focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary
                     appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%236b7280%22><path fill-rule=%22evenodd%22 d=%22M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z%22 clip-rule=%22evenodd%22/></svg>')] bg-no-repeat bg-[right_0.4rem_center] bg-[length:1rem]"
        >
          <option value="">{placeholder}</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}

      {hasFilters && (
        <button
          onClick={onClear}
          className="h-8 px-2.5 text-sm text-secondary border border-outline-variant rounded-md
                     hover:bg-surface-container transition-colors flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-sm">close</span>
          <span className="hidden sm:inline">Limpiar</span>
        </button>
      )}

      <div className="flex-1" />

      {hasFilters && (
        <span className="text-xs text-on-surface-variant hidden sm:block">
          {Object.values(filters).filter(Boolean).join(' · ')}
        </span>
      )}

      {isAdmin && (
        <button
          onClick={onSync}
          disabled={syncing}
          className="h-8 px-3 text-sm font-medium bg-primary text-white rounded-md
                     hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50
                     flex items-center gap-1.5"
        >
          <span className={`material-symbols-outlined text-sm ${syncing ? 'animate-spin' : ''}`}>sync</span>
          <span className="hidden sm:inline">{syncing ? 'Sincronizando…' : 'Sincronizar'}</span>
        </button>
      )}
    </div>
  )
}

// ── KPI Grid ───────────────────────────────────────────────────────────────

function KpiGrid({ epics, total }) {
  const withLead   = epics.filter(e => e.lead_time_days != null)
  const avgLead    = withLead.length
    ? Math.round(withLead.reduce((s, e) => s + e.lead_time_days, 0) / withLead.length)
    : null
  const inDev      = epics.filter(e => e.estado_normalizado === 'en_desarrollo' && !isCancelledOrAtRisk(e)).length
  const done       = epics.filter(e => DONE_STATUSES.includes(e.estado_normalizado) || e.fecha_done != null).length
  const atRisk     = epics.filter(isCancelledOrAtRisk).length
  const icr        = total > 0 ? Math.round((done / total) * 100) : 0

  const cards = [
    { label: 'Épicas Totales',         value: total,                      sub: 'en el período',         icon: 'layers',         color: 'text-primary' },
    { label: 'En Desarrollo',          value: inDev,                      sub: 'iniciativas activas',    icon: 'rocket_launch',  color: 'text-blue-500' },
    { label: 'Terminadas',             value: done,                       sub: `ICR ${icr}%`,            icon: 'task_alt',       color: 'text-green-600' },
    { label: 'Canceladas / En Riesgo', value: atRisk,                     sub: 'requieren atención',     icon: 'warning',        color: 'text-amber-500' },
    { label: 'Lead Time Promedio',     value: avgLead != null ? `${avgLead}d` : '—', sub: 'días por épica', icon: 'schedule', color: 'text-secondary' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map(({ label, value, sub, icon, color }) => (
        <div key={label} className="bg-white rounded-xl border border-outline-variant p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[10px] font-bold tracking-wider text-secondary uppercase leading-snug">{label}</span>
            <span
              className={`material-symbols-outlined text-xl flex-shrink-0 ${color}`}
              style={{ fontVariationSettings: '"FILL" 1' }}
            >{icon}</span>
          </div>
          <p className="text-4xl font-bold text-on-surface tabular-nums">{value}</p>
          <p className="text-[11px] text-on-surface-variant leading-snug">{sub}</p>
        </div>
      ))}
    </div>
  )
}

// ── Table ──────────────────────────────────────────────────────────────────

function InitiativesTable({ epics }) {
  return (
    <div className="bg-white rounded-xl border border-outline-variant overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary">table_chart</span>
          <h2 className="text-sm font-bold tracking-wider text-on-surface uppercase">Detalle de Iniciativas</h2>
        </div>
        <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-1 rounded-full">
          {epics.length} épica{epics.length !== 1 ? 's' : ''}
        </span>
      </div>

      {epics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl opacity-30">table_rows</span>
          <p className="text-sm opacity-60">No hay épicas para los filtros seleccionados</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-outline-variant">
                <th className="px-5 py-3 text-[11px] font-bold tracking-wider text-secondary uppercase">Épica</th>
                <th className="px-5 py-3 text-[11px] font-bold tracking-wider text-secondary uppercase">Estado</th>
                <th className="px-5 py-3 text-[11px] font-bold tracking-wider text-secondary uppercase hidden md:table-cell">Responsable</th>
                <th className="px-5 py-3 text-[11px] font-bold tracking-wider text-secondary uppercase hidden sm:table-cell">Sprint Inicio</th>
                <th className="px-5 py-3 text-[11px] font-bold tracking-wider text-secondary uppercase hidden sm:table-cell text-right">Lead Time</th>
                <th className="px-5 py-3 text-[11px] font-bold tracking-wider text-secondary uppercase hidden md:table-cell text-right">Fecha PRD</th>
              </tr>
            </thead>
            <tbody>
              {epics.map((epic, idx) => {
                const dot   = ESTADO_DOT[epic.estado_normalizado]  || 'bg-slate-300'
                const color = ESTADO_TEXT[epic.estado_normalizado] || 'text-on-surface-variant'
                const label = ESTADO_LABELS[epic.estado_normalizado] || epic.status || '—'
                const isDone = DONE_STATUSES.includes(epic.estado_normalizado)

                return (
                  <tr
                    key={epic.id}
                    className={`border-b border-outline-variant last:border-0 hover:bg-primary/[0.03] transition-colors
                      ${idx % 2 !== 0 ? 'bg-slate-50/60' : ''}`}
                  >
                    {/* Épica */}
                    <td className="px-5 py-3.5 max-w-[260px]">
                      <div className="flex items-center gap-2.5">
                        <div className={`h-2 w-2 rounded-full flex-shrink-0 ${isDone ? 'bg-green-500' : 'bg-primary'}`} />
                        <span className="font-semibold text-on-surface leading-snug line-clamp-2">{epic.epic_name}</span>
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className={`h-2 w-2 rounded-full flex-shrink-0 ${dot}`} />
                        <span className={`text-sm font-medium ${color}`}>{label}</span>
                      </div>
                    </td>

                    {/* Responsable */}
                    <td className="hidden md:table-cell px-5 py-3.5 text-on-surface-variant whitespace-nowrap">
                      {epic.assignee || '—'}
                    </td>

                    {/* Sprint Inicio */}
                    <td className="hidden sm:table-cell px-5 py-3.5 text-on-surface-variant whitespace-nowrap">
                      {epic.sprint_inicio || '—'}
                    </td>

                    {/* Lead Time */}
                    <td className="hidden sm:table-cell px-5 py-3.5 text-right whitespace-nowrap">
                      {epic.lead_time_days != null ? (
                        <span className={`font-semibold tabular-nums ${epic.lead_time_days > 30 ? 'text-error' : 'text-on-surface'}`}>
                          {epic.lead_time_days}d
                        </span>
                      ) : <span className="text-on-surface-variant">—</span>}
                    </td>

                    {/* Fecha PRD */}
                    <td className="hidden md:table-cell px-5 py-3.5 text-on-surface-variant text-right whitespace-nowrap">
                      {epic.fecha_prd ? dayjs(epic.fecha_prd).format('DD MMM YYYY') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { isAdmin, token } = useAuth()
  const [epics,    setEpics]    = useState([])
  const [projects, setProjects] = useState([])
  const [vps,      setVps]      = useState([])
  const [loading,  setLoading]  = useState(true)
  const [syncing,  setSyncing]  = useState(false)
  const [filters,  setFilters]  = useState({ vp: '', squad: '', quarter: '', year: '' })

  useEffect(() => {
    Promise.all([
      getEpics().catch(() => []),
      getSyncStatus().catch(() => null),
      getProjects().catch(() => []),
      getVps().catch(() => []),
    ]).then(([epicsData, , projectsData, vpsData]) => {
      setEpics(epicsData)
      setProjects(projectsData)
      setVps(vpsData)
    }).finally(() => setLoading(false))
  }, [])

  const filteredEpics = epics.filter(e => {
    if (filters.squad   && e.project_key !== filters.squad)       return false
    if (filters.quarter && String(e.quarter) !== filters.quarter) return false
    if (filters.year    && String(e.year)    !== filters.year)    return false
    if (filters.vp) {
      const proj = projects.find(p => p.project_key === e.project_key)
      if (!proj || proj.vp !== filters.vp) return false
    }
    return true
  })

  const handleSync = async () => {
    setSyncing(true)
    try {
      await triggerSync(token)
      const data = await getEpics()
      setEpics(data)
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">refresh</span>
      </div>
    )
  }

  const total     = filteredEpics.length
  const hasData   = epics.length > 0
  const hasFilter = Object.values(filters).some(Boolean)

  return (
    <div className="flex flex-col gap-5">

      {/* ① Filter Bar — break out of main padding, sticky top */}
      <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6">
        <FilterBar
          filters={filters}
          vps={vps}
          projects={projects}
          onChange={setFilters}
          onClear={() => setFilters({ vp: '', squad: '', quarter: '', year: '' })}
          onSync={handleSync}
          syncing={syncing}
          isAdmin={isAdmin}
        />
      </div>

      <div className="space-y-5 max-w-[1440px] mx-auto w-full">

        {/* ② Page Title — Z top-left anchor */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface">Portfolio de Iniciativas</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {hasFilter
              ? `${total} épica${total !== 1 ? 's' : ''} · ${Object.values(filters).filter(Boolean).join(' · ')}`
              : `${total} épica${total !== 1 ? 's' : ''} · Todos los squads`}
          </p>
        </div>

        {/* ③ KPIs — Z horizontal scan */}
        {hasData
          ? <KpiGrid epics={filteredEpics} total={total} />
          : (
            <div className="bg-white rounded-xl border border-outline-variant flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-5xl opacity-30">bar_chart</span>
              <p className="text-sm opacity-60">Sin datos. Sincroniza Jira para comenzar.</p>
            </div>
          )
        }

        {/* ④ Detail Table — Z landing point */}
        <InitiativesTable epics={filteredEpics} />

      </div>
    </div>
  )
}

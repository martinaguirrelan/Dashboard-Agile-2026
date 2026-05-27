import { useState, useMemo, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getEpics, getProjects, getSprints } from '../api/epics'
import { triggerSync } from '../api/sync'
import { StatusPill, Delta, Sparkline, Progress, IconChevron, IconFilter, IconSearch, IconClose, IconArrow } from '../components/dashboard/DashUi'
import { CANCELLATION_REASONS, CANCELLATION_IMPACTS } from '../components/dashboard/constants'
import { LeadTimeChart, StatusDonut, VPLoadBars } from '../components/dashboard/DashCharts'
import { buildVPs, buildSquads, adaptEpics, buildLeadTimeTrend, buildLeadTimeBySprit } from '../components/dashboard/dataAdapter'
import '../dashboard.css'

// ── Tweaks (local state + localStorage) ──────────────────────────────────────

const TWEAK_DEFAULTS = {
  palette:      ['#eaecf4', '#1a2238', '#e65a35'],
  density:      'regular',
  chartStyle:   'rich',
  sparkInKpi:   true,
  showInsight:  true,
}

function useTweaks(defaults) {
  const [values, setValues] = useState(() => {
    try {
      const saved = localStorage.getItem('dashboard-tweaks')
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults
    } catch { return defaults }
  })
  const setTweak = useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val }
    setValues((prev) => {
      const next = { ...prev, ...edits }
      try { localStorage.setItem('dashboard-tweaks', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])
  return [values, setTweak]
}

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
function formatNow() {
  const d = new Date()
  const day  = String(d.getDate()).padStart(2, '0')
  const mon  = MONTHS[d.getMonth()]
  const year = d.getFullYear()
  const hh   = String(d.getHours()).padStart(2, '0')
  const mm   = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${mon} ${year}, ${hh}:${mm}`
}

function applyTheme(palette) {
  const [bg, ink, accent] = palette
  document.documentElement.style.setProperty('--bg', bg)
  document.documentElement.style.setProperty('--ink', ink)
  document.documentElement.style.setProperty('--accent', accent)
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header({ filters, onChange, vps, squads, isAdmin, onSync, syncing, lastUpdate }) {
  return (
    <header className="hdr">
      <div className="hdr-brand">
        <div className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="32" height="32">
            <rect x="2" y="2" width="28" height="28" rx="6" fill="var(--ink)"/>
            <path d="M9 22 L9 14 L13 18 L17 12 L23 22" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
            <circle cx="23" cy="10" r="2.2" fill="var(--accent)"/>
          </svg>
        </div>
        <div>
          <div className="brand-kicker mono">TRANSFORMACIÓN ÁGIL · BOARD EJECUTIVO</div>
          <h1>Portafolio de Iniciativas</h1>
          <div className="brand-sub">
            <span>
              {filters.q !== 'all' ? `Q${filters.q}` : 'Año completo'} {filters.year}
            </span>
            {lastUpdate && (
              <>
                <span className="dot-sep">·</span>
                <span>Actualizado <em>{lastUpdate}</em></span>
              </>
            )}
            <span className="dot-sep">·</span>
            <span className="live"><i/>Datos en vivo</span>
            {isAdmin && (
              <>
                <span className="dot-sep">·</span>
                <button
                  onClick={onSync}
                  disabled={syncing}
                  style={{
                    appearance: 'none', background: 'transparent', border: '1px solid var(--rule)',
                    borderRadius: 6, padding: '2px 10px', fontSize: 11, color: 'var(--ink-60)',
                    cursor: syncing ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    opacity: syncing ? 0.5 : 1,
                  }}
                >
                  {syncing ? '⏳ Sincronizando…' : '↻ Sincronizar Jira'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <FilterBar filters={filters} onChange={onChange} vps={vps} squads={squads} />
    </header>
  )
}

// ── FilterBar ─────────────────────────────────────────────────────────────────

function FilterBar({ filters, onChange, vps, squads }) {
  const [openMobile, setOpenMobile] = useState(false)
  const squadsForVp = filters.vp === 'all' ? squads : squads.filter((s) => s.vp === filters.vp)
  const active = [
    filters.vp !== 'all' && vps.find((v) => v.id === filters.vp)?.short,
    filters.squad !== 'all' && squads.find((s) => s.id === filters.squad)?.name,
  ].filter(Boolean)

  const selectedSquad = filters.squad !== 'all' ? squads.find((s) => s.id === filters.squad) : null

  return (
    <>
      <div className="filters" data-mobile-open={openMobile ? '1' : '0'}>
        <button className="filter-mobile-close" onClick={() => setOpenMobile(false)} aria-label="Cerrar filtros">
          <IconClose/>
        </button>
        <div className="filter-mobile-title">Filtros</div>

        <FilterSelect label="Año" value={filters.year}
                      options={[{v:2026,l:'2026'},{v:2025,l:'2025'},{v:2024,l:'2024'}]}
                      onChange={(v) => onChange({ year: Number(v) })}/>
        <FilterSelect label="Trimestre" value={filters.q}
                      options={[{v:'all',l:'Año completo'},{v:1,l:'Q1'},{v:2,l:'Q2'},{v:3,l:'Q3'},{v:4,l:'Q4'}]}
                      onChange={(v) => onChange({ q: v === 'all' ? 'all' : Number(v) })}/>
        <FilterSelect label="VP" value={filters.vp}
                      options={[{v:'all',l:'Todas las VPs'}, ...vps.map((v) => ({v:v.id,l:v.short}))]}
                      onChange={(v) => onChange({ vp: v, squad: 'all' })}/>
        <FilterSelect label="Squad" value={filters.squad}
                      options={[{v:'all',l:'Todos los squads'}, ...squadsForVp.map((s) => ({v:s.id,l:s.name}))]}
                      onChange={(v) => onChange({ squad: v })}/>

        {selectedSquad && (
          <Link
            to={`/squad/${selectedSquad.id.toUpperCase()}`}
            className="btn-primary"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => setOpenMobile(false)}
          >
            Detalle <IconArrow/>
          </Link>
        )}

        <button className="btn-reset" onClick={() => onChange({ year: 2026, q: 2, vp: 'all', squad: 'all' })}>
          Restablecer
        </button>
      </div>

      <button className="filter-toggle" onClick={() => setOpenMobile(true)} aria-label="Abrir filtros">
        <IconFilter/>
        <span>Filtros</span>
        {active.length > 0 && <em>{active.length}</em>}
      </button>
    </>
  )
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <label className="filter-field">
      <span className="filter-label mono">{label}</span>
      <div className="filter-select-wrap">
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <IconChevron/>
      </div>
    </label>
  )
}

// ── KPI Strip ─────────────────────────────────────────────────────────────────

function KpiStrip({ initiatives, trend, sparkOn }) {
  const total      = initiatives.length
  const done       = initiatives.filter((i) => i.status === 'done').length
  const inProgress = initiatives.filter((i) => i.status === 'progress').length
  const atRisk     = initiatives.filter((i) => i.status === 'risk' || i.status === 'blocked').length
  const planned    = initiatives.filter((i) => i.status !== 'cancelled').length

  const fulfillment      = planned > 0 ? Math.round((done / planned) * 100) : 0
  const fulfillmentColor = fulfillment >= 80 ? '#1f6b3a' : fulfillment >= 60 ? '#c98a1e' : '#b13434'
  const fulfillmentTrend = [58, 61, 64, 66, 68, 69, 70, 71, 72, 72, 73, fulfillment]

  const ltSamples = initiatives.filter((i) => i.leadtime > 0).map((i) => i.leadtime)
  const avgLT = ltSamples.length ? Math.round(ltSamples.reduce((a, b) => a + b, 0) / ltSamples.length) : 0
  const p90LT = ltSamples.length
    ? Math.round([...ltSamples].sort((a, b) => a - b)[Math.floor(ltSamples.length * 0.9)] || 0)
    : 0
  const trendVals = trend.map((d) => d.avg)
  const tpTrend   = trend.map((d) => d.throughput)
  const riskTrend = [2, 3, 3, 4, 4, 3, 4, 5, 4, 4, 3, atRisk]
  const doneTrend = [1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10, done]

  return (
    <div className="kpis">
      <KpiCard label="Lead time promedio" value={avgLT} suffix="d" delta={-8} invert
               hint={`P90 ${p90LT}d · ${ltSamples.length} épicas`}
               sparkVals={sparkOn ? trendVals : null} sparkColor="var(--accent)"/>
      <KpiCard label="Throughput" value={done} suffix=" / trim." delta={+5}
               hint={`${inProgress} activas`} sparkVals={sparkOn ? tpTrend : null} sparkColor="#155e9c"/>
      <KpiCard label="Iniciativas en riesgo" value={atRisk} suffix="" delta={0} invert
               hint={`${Math.round((atRisk / Math.max(1, total)) * 100)}% del portafolio`}
               sparkVals={sparkOn ? riskTrend : null} sparkColor="#b13434"/>
      <KpiCard label="Completadas" value={done} suffix="" delta={+5}
               hint={`de ${total} totales`} sparkVals={sparkOn ? doneTrend : null} sparkColor="#1f6b3a"/>
      <KpiCard label="Cumplimiento" value={fulfillment} suffix="%" delta={+3}
               hint={`${done}/${planned} completadas`}
               sparkVals={sparkOn ? fulfillmentTrend : null} sparkColor={fulfillmentColor}/>
    </div>
  )
}

function KpiCard({ label, value, suffix, delta, invert, hint, sparkVals, sparkColor }) {
  return (
    <div className="kpi">
      <div className="kpi-label mono">{label}</div>
      <div className="kpi-row">
        <div className="kpi-value">
          <span className="kpi-num">{value}</span>
          <span className="kpi-suffix">{suffix}</span>
        </div>
        {sparkVals && <Sparkline values={sparkVals} color={sparkColor}/>}
      </div>
      <div className="kpi-foot">
        <Delta value={delta} invert={invert}/>
        <span className="kpi-hint">{hint}</span>
      </div>
    </div>
  )
}

// ── Insight Callout ───────────────────────────────────────────────────────────

function InsightCallout({ initiatives, vps, squads }) {
  const atRisk = initiatives.filter((i) => i.status === 'risk' || i.status === 'blocked')
  const worst = [...atRisk].sort((a, b) => b.leadtime - a.leadtime).slice(0, 3)
  const squadOf = (id) => squads.find((s) => s.id === id)
  const vpOf = (sq) => {
    const squad = squadOf(sq)
    return vps.find((v) => v.id === squad?.vp)
  }

  if (worst.length === 0) return null

  return (
    <div className="insight">
      <div className="insight-head">
        <div>
          <span className="insight-tag mono">⌁ ATENCIÓN EJECUTIVA</span>
          <h3>{worst.length} iniciativa{worst.length !== 1 ? 's' : ''} concentran el riesgo del trimestre</h3>
        </div>
        <button className="btn-ghost">Plan de acción <IconArrow/></button>
      </div>
      <ul className="insight-list">
        {worst.map((i, idx) => (
          <li key={i.id}>
            <span className="insight-rank mono">0{idx + 1}</span>
            <div className="insight-body">
              <div className="insight-row1">
                <strong>{i.name}</strong>
                <span className="mono muted">{i.id}</span>
              </div>
              <div className="insight-row2">
                <span>{vpOf(i.squad)?.short}</span>
                <span className="dot-sep">·</span>
                <span>{squadOf(i.squad)?.name}</span>
                {i.leadtime > 0 && (
                  <>
                    <span className="dot-sep">·</span>
                    <span>Lead time <em className="mono">{i.leadtime}d</em></span>
                  </>
                )}
              </div>
            </div>
            <StatusPill status={i.status}/>
          </li>
        ))}
      </ul>
      <div className="insight-foot mono">
        Recomendación · revisar capacidad de squads en riesgo y priorizar resolución de bloqueantes antes del cierre de trimestre.
      </div>
    </div>
  )
}

// ── InsightRow ────────────────────────────────────────────────────────────────

function InsightRow({ initiatives, vps, squads, onShowCancelled }) {
  const hasCancelled = initiatives.some((i) => i.status === 'cancelled')
  const atRisk = initiatives.filter((i) => i.status === 'risk' || i.status === 'blocked')
  if (!hasCancelled && atRisk.length === 0) return null
  const cols = hasCancelled && atRisk.length > 0 ? '340px 1fr' : '1fr'
  return (
    <section className="row-insight" style={{ gridTemplateColumns: cols }}>
      {hasCancelled && <CancelledCard initiatives={initiatives} onShowCancelled={onShowCancelled}/>}
      {atRisk.length > 0 && <InsightCallout initiatives={initiatives} vps={vps} squads={squads}/>}
    </section>
  )
}

// ── CancelledCard ─────────────────────────────────────────────────────────────

function CancelledCard({ initiatives, onShowCancelled }) {
  const cancelled = initiatives.filter((i) => i.status === 'cancelled')
  if (cancelled.length === 0) return null

  const reasonCounts = {}
  cancelled.forEach((i) => {
    if (i.reason) reasonCounts[i.reason] = (reasonCounts[i.reason] || 0) + 1
  })
  const topReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)

  return (
    <div className="cancelled-card">
      <div className="cancelled-head">
        <div>
          <span className="cancelled-tag mono">⊘ CANCELADAS</span>
          <h4>{cancelled.length} iniciativa{cancelled.length !== 1 ? 's' : ''} cancelada{cancelled.length !== 1 ? 's' : ''} este período</h4>
        </div>
        <button className="btn-ghost dark btn-small" onClick={onShowCancelled}>
          Ver análisis <IconArrow/>
        </button>
      </div>
      {topReasons.length > 0 && (
        <ul className="cancelled-list">
          {topReasons.map(([reason, count]) => (
            <li key={reason}>
              <span className="cancelled-count">{count}</span>
              <span>{CANCELLATION_REASONS[reason] || reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── InitiativesTable ──────────────────────────────────────────────────────────

function InitiativesTable({ initiatives, squads, vps, onSelect, tab, onTabChange }) {
  const [sort, setSort] = useState({ key: 'leadtime', dir: 'desc' })
  const [query, setQuery] = useState('')

  const squadOf = (id) => squads.find((s) => s.id === id)
  const vpOf = (sq) => {
    const squad = squadOf(sq)
    return vps.find((v) => v.id === squad?.vp)
  }

  const active    = initiatives.filter((i) => i.status !== 'cancelled')
  const cancelled = initiatives.filter((i) => i.status === 'cancelled')
  const source    = tab === 'cancelled' ? cancelled : active

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = q
      ? source.filter((i) =>
          i.name.toLowerCase().includes(q) ||
          i.id.toLowerCase().includes(q) ||
          squadOf(i.squad)?.name.toLowerCase().includes(q) ||
          i.owner.toLowerCase().includes(q)
        )
      : source
    list = [...list].sort((a, b) => {
      const va = a[sort.key], vb = b[sort.key]
      if (va === vb) return 0
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return list
  }, [source, query, sort, squads])

  const head = (key, label, num) => (
    <th onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))}
        className={(num ? 'num ' : '') + (sort.key === key ? 'sorted' : '')}>
      {label}
      <i className="sort-arrow">{sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</i>
    </th>
  )

  const progressTone = (i) =>
    i.status === 'done'     ? 'ok'     :
    i.status === 'risk'     ? 'warn'   :
    i.status === 'blocked'  ? 'danger' :
    i.status === 'progress' ? 'info'   : 'neutral'

  return (
    <section className="table-card">
      <div className="table-head">
        <div>
          <h3>Iniciativas <span className="muted mono">· {filtered.length}</span></h3>
          <p className="muted">Clic para abrir detalle</p>
        </div>
        <div className="table-search">
          <IconSearch/>
          <input placeholder="Buscar por nombre, squad, ID…"
                 value={query} onChange={(e) => setQuery(e.target.value)}/>
        </div>
      </div>

      {cancelled.length > 0 && (
        <div className="table-tabs">
          <button className={`table-tab${tab !== 'cancelled' ? ' active' : ''}`}
                  onClick={() => onTabChange('active')}>
            Activas <em>{active.length}</em>
          </button>
          <button className={`table-tab${tab === 'cancelled' ? ' active' : ''}`}
                  onClick={() => onTabChange('cancelled')}>
            Canceladas <em>{cancelled.length}</em>
          </button>
        </div>
      )}

      <div className="table-scroll">
        {tab !== 'cancelled' ? (
          <>
            <table className="initiatives-table">
              <thead>
                <tr>
                  {head('id',       'ID',        false)}
                  {head('name',     'Iniciativa', false)}
                  <th>Estado</th>
                  {head('leadtime', 'Lead time',  true)}
                  <th>Squad</th>
                  <th>VP</th>
                  <th>Avance</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} onClick={() => onSelect(i)}>
                    <td className="mono muted">{i.id}</td>
                    <td className="cell-name">
                      <strong>{i.name}</strong>
                      <span className="muted">{i.owner}</span>
                    </td>
                    <td><StatusPill status={i.status}/></td>
                    <td className="num mono">{i.leadtime > 0 ? `${i.leadtime}d` : '—'}</td>
                    <td style={{ color: 'var(--ink)', fontWeight: 500 }}>
                      {squadOf(i.squad)?.name || i.squad}
                    </td>
                    <td className="muted">{vpOf(i.squad)?.short}</td>
                    <td className="cell-progress"><Progress value={i.progress} tone={progressTone(i)}/></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="7" className="empty">Sin iniciativas para los filtros seleccionados.</td></tr>
                )}
              </tbody>
            </table>
            <div className="table-cards">
              {filtered.map((i) => (
                <button key={i.id} className="m-card" onClick={() => onSelect(i)}>
                  <div className="m-card-r1">
                    <span className="mono muted">{i.id}</span>
                    <StatusPill status={i.status}/>
                  </div>
                  <strong>{i.name}</strong>
                  <div className="m-card-meta">
                    <span>{squadOf(i.squad)?.name}</span>
                    <span className="dot-sep">·</span>
                    <span className="muted">{vpOf(i.squad)?.short}</span>
                  </div>
                  <div className="m-card-foot">
                    <span className="mono"><em>Lead time</em> {i.leadtime > 0 ? `${i.leadtime}d` : '—'}</span>
                  </div>
                  <Progress value={i.progress} tone={progressTone(i)}/>
                </button>
              ))}
              {filtered.length === 0 && <div className="empty">Sin iniciativas para los filtros seleccionados.</div>}
            </div>
          </>
        ) : (
          <>
            <table className="initiatives-table">
              <thead>
                <tr>
                  {head('id',           'ID',          false)}
                  {head('name',         'Iniciativa',  false)}
                  {head('cancelled_at', 'Cancelada',   false)}
                  <th>Razón</th>
                  <th>Impacto</th>
                  <th>Squad</th>
                  <th>VP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} onClick={() => onSelect(i)}>
                    <td className="mono muted">{i.id}</td>
                    <td className="cell-name">
                      <strong>{i.name}</strong>
                      <span className="muted">{i.owner}</span>
                    </td>
                    <td className="mono muted">
                      {i.cancelled_at ? new Date(i.cancelled_at).toLocaleDateString('es', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                    </td>
                    <td>{CANCELLATION_REASONS[i.reason] || (i.reason || '—')}</td>
                    <td className="muted">{CANCELLATION_IMPACTS[i.impact] || (i.impact || '—')}</td>
                    <td>{squadOf(i.squad)?.name || i.squad}</td>
                    <td className="muted">{vpOf(i.squad)?.short}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="7" className="empty">Sin iniciativas canceladas en este período.</td></tr>
                )}
              </tbody>
            </table>
            <div className="table-cards">
              {filtered.map((i) => (
                <button key={i.id} className="m-card" onClick={() => onSelect(i)}>
                  <div className="m-card-r1">
                    <span className="mono muted">{i.id}</span>
                    <StatusPill status="cancelled"/>
                  </div>
                  <strong>{i.name}</strong>
                  <div className="m-card-meta">
                    <span>{CANCELLATION_REASONS[i.reason] || '—'}</span>
                  </div>
                  <div className="m-card-foot">
                    <span className="mono muted">
                      {i.cancelled_at ? new Date(i.cancelled_at).toLocaleDateString('es', { day:'2-digit', month:'short' }) : '—'}
                    </span>
                    <span>{CANCELLATION_IMPACTS[i.impact] || '—'}</span>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && <div className="empty">Sin iniciativas canceladas en este período.</div>}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ item, onClose, squads, vps }) {
  if (!item) return null
  const squad = squads.find((s) => s.id === item.squad)
  const vp    = vps.find((v) => v.id === squad?.vp)

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}/>
      <aside className="drawer" role="dialog" aria-label={`Detalle ${item.name}`}>
        <header>
          <div>
            <span className="mono muted">{item.id}</span>
            <h3>{item.name}</h3>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Cerrar"><IconClose/></button>
        </header>
        <div className="drawer-status">
          <StatusPill status={item.status}/>
          <span className="muted">Owner · <strong>{item.owner}</strong></span>
        </div>
        <dl className="drawer-grid">
          <div><dt>VP</dt><dd>{vp?.name || '—'}</dd></div>
          <div><dt>Squad</dt><dd>{squad?.name || item.squad}</dd></div>
          <div><dt>Lead time</dt><dd className="mono">{item.leadtime > 0 ? `${item.leadtime}d` : '—'}</dd></div>
          <div><dt>Sprint inicio</dt><dd>{item.sprint_inicio || '—'}</dd></div>
          <div><dt>Valor de negocio</dt><dd>{item.value}</dd></div>
          <div><dt>Riesgo</dt><dd>{item.risk}</dd></div>
          <div><dt>Trimestre</dt><dd>{item.year} · Q{item.q}</dd></div>
          <div><dt>Avance</dt><dd><Progress value={item.progress} tone="info"/></dd></div>
          {item.fecha_prd && <div><dt>Fecha PRD</dt><dd className="mono">{item.fecha_prd}</dd></div>}
          {item.estado_iniciativa && <div><dt>Estado iniciativa</dt><dd>{item.estado_iniciativa}</dd></div>}
        </dl>
        {item.status === 'cancelled' ? (
          <div className="cancelled-card" style={{ margin: '0' }}>
            <div>
              <span className="cancelled-tag mono">⊘ CANCELACIÓN</span>
            </div>
            <ul className="cancelled-list">
              <li>
                <span className="cancelled-count" style={{ minWidth: 'auto', padding: '0 6px' }}>Fecha</span>
                <span className="mono">
                  {item.cancelled_at
                    ? new Date(item.cancelled_at).toLocaleDateString('es', { day:'2-digit', month:'long', year:'numeric' })
                    : '—'}
                </span>
              </li>
              <li>
                <span className="cancelled-count" style={{ minWidth: 'auto', padding: '0 6px' }}>Razón</span>
                <span>{CANCELLATION_REASONS[item.reason] || item.reason || '—'}</span>
              </li>
              <li>
                <span className="cancelled-count" style={{ minWidth: 'auto', padding: '0 6px' }}>Impacto</span>
                <span>{CANCELLATION_IMPACTS[item.impact] || item.impact || '—'}</span>
              </li>
            </ul>
          </div>
        ) : (
          <div className="drawer-timeline">
            <h5 className="mono">CICLO DE FLUJO</h5>
            <ol>
              <li className="done"><span/>Discovery</li>
              <li className={item.progress > 20 ? 'done' : ''}><span/>Refinamiento</li>
              <li className={item.progress > 40 ? 'done' : item.progress > 20 ? 'active' : ''}><span/>Build</li>
              <li className={item.progress > 80 ? 'done' : item.progress > 50 ? 'active' : ''}><span/>UAT</li>
              <li className={item.progress >= 100 ? 'done' : ''}><span/>Producción</li>
            </ol>
          </div>
        )}
        <footer>
          <button className="btn-ghost dark">Compartir reporte</button>
        </footer>
      </aside>
    </>
  )
}

// ── TweaksPanel ───────────────────────────────────────────────────────────────

function TweaksPanel({ t, setTweak }) {
  const [open, setOpen] = useState(false)
  const palettes = [
    ['#eaecf4','#1a2238','#e65a35'],
    ['#eaecf4','#1a2238','#2a5cb0'],
    ['#f4f1ea','#14171c','#c98a1e'],
    ['#ecede8','#1b2620','#3a7a55'],
    ['#15171c','#f0f2f7','#e65a35'],
  ]

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'fixed', right: 16, bottom: 16, zIndex: 2000,
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--ink)', color: 'var(--bg)',
          border: 'none', fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,.18)',
        }}
        aria-label="Tweaks"
      >
        ⚙
      </button>

      {open && (
        <div style={{
          position: 'fixed', right: 60, bottom: 16, zIndex: 2000,
          background: 'rgba(250,249,247,.92)', backdropFilter: 'blur(20px)',
          border: '.5px solid rgba(255,255,255,.6)', borderRadius: 14,
          boxShadow: '0 12px 40px rgba(0,0,0,.18)',
          padding: '12px 16px', width: 240,
          fontFamily: 'system-ui, sans-serif', fontSize: 12,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: '#29261b' }}>Tweaks</div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(41,38,27,.45)', marginBottom: 8 }}>PALETA</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {palettes.map((p, i) => (
                <button key={i} onClick={() => setTweak('palette', p)}
                  style={{
                    width: 32, height: 32, borderRadius: 6, border: 'none',
                    background: p[0],
                    boxShadow: JSON.stringify(t.palette) === JSON.stringify(p)
                      ? '0 0 0 2px #000' : '0 0 0 .5px rgba(0,0,0,.2)',
                    cursor: 'pointer', position: 'relative', overflow: 'hidden',
                  }}>
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: '40%', height: '100%', background: p[2] }}/>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(41,38,27,.45)', marginBottom: 8 }}>DENSIDAD</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['compact','regular','comfy'].map((d) => (
                <button key={d} onClick={() => setTweak('density', d)}
                  style={{
                    flex: 1, padding: '4px 0', borderRadius: 6, border: 'none',
                    background: t.density === d ? 'rgba(0,0,0,.12)' : 'transparent',
                    cursor: 'pointer', fontSize: 11, fontWeight: t.density === d ? 600 : 400,
                  }}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ color: 'rgba(41,38,27,.72)' }}>Gráfico</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {['minimal','rich'].map((s) => (
                <button key={s} onClick={() => setTweak('chartStyle', s)}
                  style={{
                    padding: '3px 8px', borderRadius: 5, border: 'none',
                    background: t.chartStyle === s ? 'rgba(0,0,0,.12)' : 'transparent',
                    cursor: 'pointer', fontSize: 11, fontWeight: t.chartStyle === s ? 600 : 400,
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ color: 'rgba(41,38,27,.72)' }}>Sparklines</span>
            <button onClick={() => setTweak('sparkInKpi', !t.sparkInKpi)}
              style={{
                width: 32, height: 18, borderRadius: 999, border: 'none',
                background: t.sparkInKpi ? '#34c759' : 'rgba(0,0,0,.15)',
                cursor: 'pointer', position: 'relative', transition: 'background .15s',
              }}>
              <div style={{
                position: 'absolute', top: 2, left: t.sparkInKpi ? 14 : 2,
                width: 14, height: 14, borderRadius: '50%', background: '#fff',
                transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.25)',
              }}/>
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'rgba(41,38,27,.72)' }}>Bloque insight</span>
            <button onClick={() => setTweak('showInsight', !t.showInsight)}
              style={{
                width: 32, height: 18, borderRadius: 999, border: 'none',
                background: t.showInsight ? '#34c759' : 'rgba(0,0,0,.15)',
                cursor: 'pointer', position: 'relative', transition: 'background .15s',
              }}>
              <div style={{
                position: 'absolute', top: 2, left: t.showInsight ? 14 : 2,
                width: 14, height: 14, borderRadius: '50%', background: '#fff',
                transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.25)',
              }}/>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { isAdmin, token } = useAuth()
  const [t, setTweak]       = useTweaks(TWEAK_DEFAULTS)
  const [filters, setFilters] = useState({ year: 2026, q: 2, vp: 'all', squad: 'all' })
  const [selected, setSelected] = useState(null)
  const [rawEpics, setRawEpics]     = useState([])
  const [projects, setProjects]     = useState([])
  const [sprints, setSprints]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [syncing, setSyncing]       = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [tableTab, setTableTab]     = useState('active')

  useEffect(() => {
    Promise.all([
      getEpics().catch(() => []),
      getProjects().catch(() => []),
      getSprints().catch(() => []),
    ]).then(([epicsData, projectsData, sprintsData]) => {
      setRawEpics(epicsData)
      setProjects(projectsData)
      setSprints(sprintsData)
    }).then(() => {
      setLastUpdate(formatNow())
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { applyTheme(t.palette) }, [t.palette])
  useEffect(() => { document.body.dataset.density = t.density }, [t.density])

  const vps    = useMemo(() => buildVPs(projects), [projects])
  const squads = useMemo(() => buildSquads(projects, vps), [projects, vps])
  const allInitiatives = useMemo(() => adaptEpics(rawEpics, projects), [rawEpics, projects])
  const trend  = useMemo(() => sprints.length > 0 ? buildLeadTimeBySprit(sprints) : buildLeadTimeTrend(rawEpics), [sprints, rawEpics])

  const onFilterChange = (patch) => setFilters((f) => ({ ...f, ...patch }))

  const filtered = useMemo(() => {
    return allInitiatives.filter((i) => {
      if (i.year !== filters.year) return false
      if (filters.q !== 'all' && i.q !== filters.q) return false
      if (filters.vp !== 'all' && i.vp !== filters.vp) return false
      if (filters.squad !== 'all' && i.squad !== filters.squad) return false
      return true
    })
  }, [allInitiatives, filters])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await triggerSync(token)
      const [epicsData, projectsData, sprintsData] = await Promise.all([getEpics(), getProjects(), getSprints()])
      setRawEpics(epicsData)
      setProjects(projectsData)
      setSprints(sprintsData)
      setLastUpdate(formatNow())
    } finally {
      setSyncing(false)
    }
  }

  const accent = t.palette[2]

  if (loading) {
    return (
      <div className="dash-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--ink-45)', fontFamily: 'Fira Sans, sans-serif' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <p>Cargando portafolio…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dash-root">
      <div className="app" data-screen-label="Dashboard Agile">

        <Header
          filters={filters}
          onChange={onFilterChange}
          vps={vps}
          squads={squads}
          isAdmin={isAdmin}
          onSync={handleSync}
          syncing={syncing}
          lastUpdate={lastUpdate}
        />

        <KpiStrip initiatives={filtered} trend={trend} sparkOn={t.sparkInKpi} />

        <section className="row-mid">
          <div className="card card-trend" data-screen-label="Lead time trend">
            <LeadTimeChart data={trend} style={t.chartStyle} accent={accent}/>
          </div>
          <div className="row-mid-right">
            <div className="card card-donut" data-screen-label="Status breakdown">
              <div className="card-head">
                <h4>Estado del portafolio</h4>
                <p className="muted">Distribución por etapa</p>
              </div>
              <StatusDonut initiatives={filtered} accent={accent}/>
            </div>
            <div className="card card-vp">
              <div className="card-head">
                <h4>Carga por VP</h4>
                <p className="muted">Iniciativas · color por estado</p>
              </div>
              <VPLoadBars initiatives={filtered} vps={vps} squads={squads}/>
            </div>
          </div>
        </section>

        {t.showInsight && (
          <InsightRow initiatives={filtered} vps={vps} squads={squads} onShowCancelled={() => setTableTab('cancelled')}/>
        )}

        <InitiativesTable
          initiatives={filtered}
          squads={squads}
          vps={vps}
          onSelect={setSelected}
          tab={tableTab}
          onTabChange={setTableTab}
        />

        <DetailDrawer
          item={selected}
          onClose={() => setSelected(null)}
          squads={squads}
          vps={vps}
        />

        <footer className="page-foot mono">
          <span>Head of Transformation · Portafolio Agile</span>
          <span>Dashboard Agile 2026</span>
        </footer>

      </div>

      <TweaksPanel t={t} setTweak={setTweak}/>
    </div>
  )
}

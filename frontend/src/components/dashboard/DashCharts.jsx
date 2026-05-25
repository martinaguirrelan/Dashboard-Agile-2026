import { STATUSES, TONE_COLOR } from './constants'

// ── LeadTimeChart ────────────────────────────────────────────────────────────

export function LeadTimeChart({ data, style = 'rich', accent = '#e65a35' }) {
  if (!data || !data.length) return null
  const W = 720, H = 240
  const padL = 36, padR = 12, padT = 18, padB = 28
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const maxLT = Math.max(...data.map((d) => d.p90)) * 1.05
  const yLT = (v) => padT + innerH - (v / maxLT) * innerH
  const x = (i) => padL + (i / (data.length - 1)) * innerW

  const maxTP = Math.max(...data.map((d) => d.throughput))
  const tpH = (v) => (v / maxTP) * (innerH * 0.35)

  const path = (key) =>
    data.map((d, i) => (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ',' + yLT(d[key]).toFixed(1)).join(' ')
  const area = (key) =>
    path(key) + ` L ${x(data.length - 1).toFixed(1)},${padT + innerH} L ${x(0).toFixed(1)},${padT + innerH} Z`

  const gridY = [0, 30, 60, 90, 120]

  return (
    <div className="chart-wrap">
      <div className="chart-head">
        <div>
          <h4>Lead time semanal</h4>
          <p className="muted">P50, promedio y P90 · throughput cohorte</p>
        </div>
        <div className="chart-legend">
          <span><i style={{ background: accent }} />Promedio</span>
          <span><i style={{ background: accent, opacity: .35 }} />P90</span>
          <span><i className="legend-bar" />Throughput</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="xMidYMid meet">
        {gridY.filter((v) => v <= maxLT).map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={yLT(v)} y2={yLT(v)} stroke="rgba(26,34,56,.06)" strokeWidth="1"/>
            <text x={padL - 6} y={yLT(v) + 3} fontSize="10" fill="rgba(26,34,56,.45)" textAnchor="end" fontFamily="IBM Plex Mono, monospace">{v}d</text>
          </g>
        ))}
        {style !== 'minimal' && data.map((d, i) => {
          const bw = (innerW / data.length) * 0.55
          const bx = x(i) - bw / 2
          const by = padT + innerH - tpH(d.throughput)
          return <rect key={i} x={bx} y={by} width={bw} height={tpH(d.throughput)} fill="rgba(26,34,56,.08)" rx="1.5"/>
        })}
        {style !== 'minimal' && (
          <path d={area('p90')} fill={accent} opacity="0.10"/>
        )}
        <path d={area('avg')} fill={accent} opacity="0.18"/>
        <path d={path('avg')} fill="none" stroke={accent} strokeWidth="2"/>
        <path d={path('p50')} fill="none" stroke="rgba(26,34,56,.55)" strokeWidth="1.2" strokeDasharray="3 3"/>
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={yLT(d.avg)} r="2.6" fill="#fff" stroke={accent} strokeWidth="1.5"/>
        ))}
        {data.map((d, i) => (
          (i === 0 || i === data.length - 1 || i % 2 === 0) && (
            <text key={i} x={x(i)} y={H - 10} fontSize="10" fill="rgba(26,34,56,.5)" textAnchor="middle" fontFamily="IBM Plex Mono, monospace">{d.w}</text>
          )
        ))}
      </svg>
    </div>
  )
}

// ── StatusDonut ───────────────────────────────────────────────────────────────

export function StatusDonut({ initiatives, accent = '#e65a35' }) {
  const total = initiatives.length || 1
  const counts = STATUSES.map((s) => ({
    ...s, n: initiatives.filter((i) => i.status === s.id).length,
  })).filter((s) => s.n > 0)

  const R = 64, r = 42, CX = 80, CY = 80
  let a0 = -Math.PI / 2
  const arcs = counts.map((c) => {
    const a1 = a0 + (c.n / total) * Math.PI * 2
    const x0 = CX + R * Math.cos(a0), y0 = CY + R * Math.sin(a0)
    const x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1)
    const xi0 = CX + r * Math.cos(a0), yi0 = CY + r * Math.sin(a0)
    const xi1 = CX + r * Math.cos(a1), yi1 = CY + r * Math.sin(a1)
    const large = a1 - a0 > Math.PI ? 1 : 0
    const d = `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${r} ${r} 0 ${large} 0 ${xi0} ${yi0} Z`
    const out = { d, color: TONE_COLOR[c.tone], label: c.label, n: c.n, pct: Math.round((c.n / total) * 100) }
    a0 = a1
    return out
  })

  return (
    <div className="donut">
      <svg viewBox="0 0 160 160" width="160" height="160" aria-hidden="true">
        {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} stroke="var(--bg)" strokeWidth="1"/>)}
        <text x="80" y="78" textAnchor="middle" fontSize="28" fontFamily="Fira Sans, sans-serif" fill="var(--ink)" fontWeight="600" letterSpacing="-0.5">{total}</text>
        <text x="80" y="96" textAnchor="middle" fontSize="9.5" fill="rgba(26,34,56,.55)" fontFamily="IBM Plex Mono, monospace" letterSpacing=".08em">INICIATIVAS</text>
      </svg>
      <ul className="donut-legend">
        {arcs.map((a) => (
          <li key={a.label}>
            <i style={{ background: a.color }} />
            <span>{a.label}</span>
            <em>{a.n}</em>
            <span className="muted mono">{a.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── VPLoadBars ────────────────────────────────────────────────────────────────

export function VPLoadBars({ initiatives, vps, squads }) {
  const squadVp = Object.fromEntries(squads.map((s) => [s.id, s.vp]))
  const rows = vps.map((vp) => {
    const items = initiatives.filter((i) => squadVp[i.squad] === vp.id)
    const by = STATUSES.map((s) => ({ ...s, n: items.filter((i) => i.status === s.id).length }))
    return { vp, total: items.length, by }
  }).filter((r) => r.total > 0)
  const max = Math.max(1, ...rows.map((r) => r.total))

  return (
    <div className="vp-bars">
      {rows.map((r) => (
        <div className="vp-bar-row" key={r.vp.id}>
          <div className="vp-bar-label">
            <span>{r.vp.short}</span>
            <em className="mono">{r.total}</em>
          </div>
          <div className="vp-bar-track">
            {r.by.filter((s) => s.n > 0).map((s) => (
              <div key={s.id} className="vp-bar-seg"
                   style={{ width: `${(s.n / max) * 100}%`, background: TONE_COLOR[s.tone] }}
                   title={`${s.label}: ${s.n}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

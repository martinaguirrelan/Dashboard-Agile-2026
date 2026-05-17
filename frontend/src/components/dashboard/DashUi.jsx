import { STATUSES, STATUS_TONE } from './constants'

export function StatusPill({ status }) {
  const s = STATUSES.find((x) => x.id === status)
  if (!s) return null
  const t = STATUS_TONE[s.tone]
  return (
    <span className="pill" style={{ color: t.fg, background: t.bg }}>
      <i style={{ background: t.dot }} />
      {s.label}
    </span>
  )
}

export function Delta({ value, invert = false }) {
  if (value === 0 || value == null) {
    return <span className="delta delta-flat">— 0</span>
  }
  const improving = invert ? value < 0 : value > 0
  const cls = improving ? 'delta delta-up' : 'delta delta-down'
  const arrow = improving ? '▼' : '▲'
  return (
    <span className={cls}>
      <span className="delta-arrow">{invert ? arrow : (value > 0 ? '▲' : '▼')}</span>
      {value > 0 ? '+' : ''}{value}
    </span>
  )
}

export function Sparkline({ values, color = '#c98a1e', height = 28, width = 88, fill = true }) {
  if (!values || !values.length) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * (width - 2) + 1,
    height - 2 - ((v - min) / range) * (height - 4),
  ])
  const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')
  const area = line + ` L ${width - 1},${height - 1} L 1,${height - 1} Z`
  return (
    <svg width={width} height={height} className="spark" aria-hidden="true">
      {fill && <path d={area} fill={color} opacity="0.12" />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.2" fill={color} />
    </svg>
  )
}

export function Progress({ value, tone = 'info' }) {
  const t = STATUS_TONE[tone] || STATUS_TONE.info
  return (
    <div className="progress">
      <div className="progress-bar" style={{ width: `${value}%`, background: t.dot }} />
      <span className="progress-label">{value}%</span>
    </div>
  )
}

export function IconChevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconFilter() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
      <path d="M1.5 2.5 H11.5 L7.5 7 V11 L5.5 10 V7 L1.5 2.5 Z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconSearch() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
      <circle cx="5.5" cy="5.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M8.2 8.2 L11 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

export function IconClose() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
      <path d="M2 2 L9 9 M9 2 L2 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

export function IconArrow({ dir = 'right' }) {
  const rot = { right: 0, down: 90, left: 180, up: 270 }[dir] || 0
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true" style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M3 2 L7 5.5 L3 9" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

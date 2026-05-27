// Burndown chart for sprints
import React from 'react'

export function BurndownChart({ sprint }) {
  if (!sprint || !sprint.burndown) return null

  const W = 600, H = 240
  const padL = 40, padR = 12, padT = 16, padB = 28
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const max = sprint.storyPointsPlanned
  const yScale = (v) => padT + innerH - (v / max) * innerH
  const xScale = (i) => padL + (i / (sprint.burndown.length - 1)) * innerW

  // Ideal line (straight from max to 0)
  const idealBurndown = Array.from({ length: sprint.burndown.length }, (_, i) =>
    max * (1 - i / (sprint.burndown.length - 1))
  )

  const pathBurndown = sprint.burndown
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(v).toFixed(1)}`)
    .join(' ')

  const pathIdeal = idealBurndown
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(v).toFixed(1)}`)
    .join(' ')

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: '8px', padding: '20px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--ink)' }}>
        Burndown: {sprint.name}
      </h3>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', minHeight: '240px' }}>
        {/* Grid lines */}
        {Array.from({ length: 5 }, (_, i) => {
          const v = (max / 4) * (4 - i)
          return (
            <g key={`grid-${i}`}>
              <line
                x1={padL}
                x2={W - padR}
                y1={yScale(v)}
                y2={yScale(v)}
                stroke="rgba(26,34,56,.06)"
                strokeWidth="1"
              />
              <text
                x={padL - 8}
                y={yScale(v) + 3}
                fontSize="10"
                fill="rgba(26,34,56,.45)"
                textAnchor="end"
                fontFamily="IBM Plex Mono, monospace"
              >
                {Math.round(v)}
              </text>
            </g>
          )
        })}

        {/* Ideal burndown line (dashed) */}
        <path d={pathIdeal} fill="none" stroke="rgba(26,34,56,.35)" strokeWidth="1.5" strokeDasharray="4 4" />

        {/* Actual burndown line */}
        <path d={pathBurndown} fill="none" stroke="var(--accent)" strokeWidth="2.5" />

        {/* Points on actual burndown */}
        {sprint.burndown.map((v, i) => (
          <circle
            key={i}
            cx={xScale(i)}
            cy={yScale(v)}
            r="2.5"
            fill="#fff"
            stroke="var(--accent)"
            strokeWidth="1.5"
          />
        ))}

        {/* X-axis labels */}
        {sprint.burndown.map((v, i) => {
          const showLabel = i === 0 || i === sprint.burndown.length - 1 || i % Math.ceil(sprint.burndown.length / 6) === 0
          return showLabel ? (
            <text
              key={`label-${i}`}
              x={xScale(i)}
              y={H - 8}
              fontSize="10"
              fill="rgba(26,34,56,.5)"
              textAnchor="middle"
              fontFamily="IBM Plex Mono, monospace"
            >
              D{i + 1}
            </text>
          ) : null
        })}
      </svg>

      {/* Legend and info */}
      <div style={{
        display: 'flex',
        gap: '20px',
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid var(--rule)',
        fontSize: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '20px', height: '2px', background: 'var(--accent)' }} />
          <span>Burndown Real</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '20px', height: '2px', background: 'rgba(26,34,56,.35)', borderTop: '2px dashed rgba(26,34,56,.35)' }} />
          <span>Burndown Ideal</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '20px' }}>
          <div>
            <div style={{ color: 'var(--ink-60)', fontSize: '10px' }}>Planeado</div>
            <div style={{ fontWeight: '700', color: 'var(--accent)' }}>{sprint.storyPointsPlanned} pts</div>
          </div>
          <div>
            <div style={{ color: 'var(--ink-60)', fontSize: '10px' }}>Completado</div>
            <div style={{ fontWeight: '700', color: '#22c55e' }}>{sprint.storyPointsCompleted} pts</div>
          </div>
          <div>
            <div style={{ color: 'var(--ink-60)', fontSize: '10px' }}>Velocidad</div>
            <div style={{ fontWeight: '700', color: '#3b82f6' }}>{sprint.velocity} pts/sprint</div>
          </div>
        </div>
      </div>
    </div>
  )
}

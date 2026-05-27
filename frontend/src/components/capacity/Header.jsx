// Header with Sprint Selector and Progress
import React from 'react'

const T = {
  bg: '#0b0d11',
  surface: '#14171c',
  border: '#1e2328',
  textPri: '#e2e8f0',
  textSec: '#8892a4',
  textMuted: '#556070',
  blue: '#3b82f6',
  green: '#22c55e',
  red: '#ef4444',
  amber: '#f59e0b',
}

export function CapacityHeader({ squad, sprint, sprints = [], onSprintChange, loading = false }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: '10px',
      padding: '28px 32px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '20px',
      }}>
        {/* Left side - Title and info */}
        <div style={{ flex: 1 }}>
          <p style={{
            fontSize: '11px',
            fontWeight: '600',
            letterSpacing: '0.08em',
            color: T.textSec,
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}>
            CAPACITY DASHBOARD
          </p>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: T.textPri,
            lineHeight: '1.2',
            marginBottom: '12px',
          }}>
            {squad?.squad || 'Squad'}
          </h1>
          <p style={{
            fontSize: '13px',
            color: T.textSec,
          }}>
            Monitoreo de capacidad y utilización del equipo
          </p>
        </div>

        {/* Right side - Sprint selector */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          alignItems: 'flex-end',
        }}>
          <label style={{
            fontSize: '11px',
            fontWeight: '600',
            letterSpacing: '0.06em',
            color: T.textSec,
            textTransform: 'uppercase',
          }}>
            Sprint Actual
          </label>
          <select
            value={sprint || ''}
            onChange={(e) => onSprintChange?.(parseInt(e.target.value))}
            disabled={loading}
            style={{
              background: T.bg,
              border: `1px solid ${T.border}`,
              borderRadius: '6px',
              padding: '8px 12px',
              color: T.textPri,
              fontSize: '13px',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {sprints.map((s) => (
              <option key={s.num} value={s.num}>
                {s.name} ({s.rango})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Progress bar */}
      {sprint && sprints.length > 0 && (
        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: T.textSec }}>
              Progreso del Sprint
            </span>
            <span style={{
              fontSize: '12px',
              fontWeight: '700',
              color: T.blue,
            }}>
              {sprint}/{sprints.length}
            </span>
          </div>
          <div style={{
            height: '8px',
            background: T.bg,
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${(sprint / sprints.length) * 100}%`,
              background: `linear-gradient(90deg, ${T.blue}, ${T.green})`,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}
    </div>
  )
}

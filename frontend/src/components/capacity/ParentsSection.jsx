// Parents (Initiatives/Epics) Section
import React, { useState } from 'react'

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

function ProgressBar({ completed, total }) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
  return (
    <div style={{
      height: '4px',
      background: T.border,
      borderRadius: '2px',
      overflow: 'hidden',
      marginTop: '4px',
    }}>
      <div style={{
        height: '100%',
        width: `${percentage}%`,
        background: percentage >= 80 ? T.green : percentage >= 50 ? T.amber : T.red,
        transition: 'width 0.3s ease',
      }} />
    </div>
  )
}

export function ParentsSection({ parents = [] }) {
  const [expandedRows, setExpandedRows] = useState(new Set())

  const toggleRow = (parentKey) => {
    const newSet = new Set(expandedRows)
    if (newSet.has(parentKey)) {
      newSet.delete(parentKey)
    } else {
      newSet.add(parentKey)
    }
    setExpandedRows(newSet)
  }

  if (!parents || parents.length === 0) {
    return (
      <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: '10px',
        padding: '32px',
        textAlign: 'center',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: T.textMuted, marginBottom: 12, display: 'block' }}>
          layers
        </span>
        <p style={{ fontSize: '14px', color: T.textSec }}>
          No hay iniciativas disponibles para este sprint
        </p>
      </div>
    )
  }

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: '10px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: T.blue }}>
          table_chart
        </span>
        <span style={{
          fontSize: '12px',
          fontWeight: '700',
          letterSpacing: '0.06em',
          color: T.textSec,
          textTransform: 'uppercase',
        }}>
          Iniciativas ({parents.length})
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '13px',
        }}>
          <thead>
            <tr style={{ background: '#0f1215' }}>
              {['KEY', 'NOMBRE', 'TIPO', 'ESTADO', 'PROGRESO', 'ESTIMACIÓN'].map((col) => (
                <th
                  key={col}
                  style={{
                    padding: '10px 20px',
                    textAlign: 'left',
                    fontSize: '11px',
                    fontWeight: '600',
                    letterSpacing: '0.06em',
                    color: T.textMuted,
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    borderBottom: `1px solid ${T.border}`,
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parents.map((parent, idx) => (
              <tr
                key={parent.key || idx}
                style={{
                  borderTop: `1px solid ${T.border}`,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#181c22' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                onClick={() => toggleRow(parent.key)}
              >
                <td style={{
                  padding: '12px 20px',
                  color: T.blue,
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                }}>
                  {parent.key}
                </td>
                <td style={{
                  padding: '12px 20px',
                  color: T.textPri,
                  fontWeight: '500',
                  maxWidth: '300px',
                }}>
                  <span style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {parent.resumen}
                  </span>
                </td>
                <td style={{
                  padding: '12px 20px',
                  color: T.textSec,
                  whiteSpace: 'nowrap',
                }}>
                  {parent.tipo_iniciativa || '—'}
                </td>
                <td style={{
                  padding: '12px 20px',
                  color: T.textSec,
                  whiteSpace: 'nowrap',
                }}>
                  {parent.estado || '—'}
                </td>
                <td style={{
                  padding: '12px 20px',
                  minWidth: '120px',
                }}>
                  <div style={{ fontSize: '11px', color: T.textSec, marginBottom: '4px' }}>
                    {parent.items_completados || 0}/{parent.items_totales || 0}
                  </div>
                  <ProgressBar
                    completed={parent.items_completados || 0}
                    total={parent.items_totales || 0}
                  />
                </td>
                <td style={{
                  padding: '12px 20px',
                  color: T.textSec,
                  whiteSpace: 'nowrap',
                }}>
                  {parent.estimacion || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        padding: '16px 24px',
        borderTop: `1px solid ${T.border}`,
        background: T.bg,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: T.blue }}>
            {parents.length}
          </div>
          <div style={{ fontSize: '10px', color: T.textMuted, marginTop: '4px' }}>Total Iniciativas</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: T.green }}>
            {Math.round(
              parents.reduce((sum, p) => sum + (p.items_completados || 0), 0) /
              Math.max(parents.reduce((sum, p) => sum + (p.items_totales || 0), 0), 1) * 100
            )}%
          </div>
          <div style={{ fontSize: '10px', color: T.textMuted, marginTop: '4px' }}>Progreso Promedio</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: T.amber }}>
            {parents.reduce((sum, p) => sum + parseInt(p.estimacion || '0'), 0)}h
          </div>
          <div style={{ fontSize: '10px', color: T.textMuted, marginTop: '4px' }}>Est. Total</div>
        </div>
      </div>
    </div>
  )
}

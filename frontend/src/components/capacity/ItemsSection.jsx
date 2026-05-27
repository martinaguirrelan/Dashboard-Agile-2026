// Items Section - All tasks/stories
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

const STATUS_CONFIG = {
  'To Do': { color: T.textMuted, icon: '○' },
  'In Progress': { color: T.amber, icon: '◐' },
  'In Review': { color: T.blue, icon: '◑' },
  'Done': { color: T.green, icon: '●' },
}

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['To Do']
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '11px',
      fontWeight: '600',
      color: config.color,
      padding: '2px 8px',
      background: T.border,
      borderRadius: '4px',
    }}>
      {config.icon} {status}
    </span>
  )
}

export function ItemsSection({ items = [] }) {
  const [filterStatus, setFilterStatus] = useState('all')

  const filteredItems = filterStatus === 'all'
    ? items
    : items.filter((item) => item.estado === filterStatus)

  const statuses = ['all', ...new Set(items.map((i) => i.estado))]

  if (!items || items.length === 0) {
    return (
      <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: '10px',
        padding: '32px',
        textAlign: 'center',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: T.textMuted, marginBottom: 12, display: 'block' }}>
          task
        </span>
        <p style={{ fontSize: '14px', color: T.textSec }}>
          No hay items para este sprint
        </p>
      </div>
    )
  }

  // Count items by status
  const statusCounts = {}
  items.forEach((item) => {
    statusCounts[item.estado] = (statusCounts[item.estado] || 0) + 1
  })

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
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: T.blue }}>
            task_alt
          </span>
          <span style={{
            fontSize: '12px',
            fontWeight: '700',
            letterSpacing: '0.06em',
            color: T.textSec,
            textTransform: 'uppercase',
          }}>
            Items ({items.length})
          </span>
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: `1px solid ${filterStatus === status ? T.blue : T.border}`,
                background: filterStatus === status ? T.border : 'transparent',
                color: filterStatus === status ? T.blue : T.textSec,
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'capitalize',
              }}
            >
              {status === 'all' ? 'Todos' : status} ({statusCounts[status] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: T.textMuted }}>
            <p>No hay items con este estado</p>
          </div>
        ) : (
          filteredItems.map((item, idx) => (
            <div
              key={item.key || idx}
              style={{
                background: T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.blue }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px',
                }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: T.blue,
                    minWidth: '60px',
                  }}>
                    {item.key}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: T.textMuted,
                    textTransform: 'uppercase',
                  }}>
                    {item.tipo}
                  </span>
                </div>
                <p style={{
                  fontSize: '13px',
                  color: T.textPri,
                  margin: 0,
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {item.resumen}
                </p>
                <div style={{
                  fontSize: '11px',
                  color: T.textSec,
                  marginTop: '4px',
                }}>
                  Asignado a: <strong>{item.persona_asignada || '—'}</strong>
                </div>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '8px',
                minWidth: '120px',
              }}>
                <StatusBadge status={item.estado} />
                {item.estimacion && (
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: T.amber,
                  }}>
                    {item.estimacion}h
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer stats */}
      {filteredItems.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '12px',
          padding: '16px 24px',
          borderTop: `1px solid ${T.border}`,
          background: T.bg,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: T.blue }}>
              {filteredItems.length}
            </div>
            <div style={{ fontSize: '10px', color: T.textMuted, marginTop: '4px' }}>Items Mostrados</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: T.amber }}>
              {filteredItems.reduce((sum, i) => sum + (parseInt(i.estimacion) || 0), 0)}h
            </div>
            <div style={{ fontSize: '10px', color: T.textMuted, marginTop: '4px' }}>Est. Total</div>
          </div>
          {filterStatus === 'all' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: T.green }}>
                {statusCounts['Done'] || 0}
              </div>
              <div style={{ fontSize: '10px', color: T.textMuted, marginTop: '4px' }}>Completados</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Alerts Section
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
  redBg: '#3b1212',
  amberBg: '#3b2a0a',
  greenBg: '#14351f',
}

const ALERT_CONFIG = {
  crítico: { color: T.red, bg: T.redBg, icon: '⚠️', label: 'Crítico' },
  atraso: { color: T.amber, bg: T.amberBg, icon: '📊', label: 'Atraso' },
  revisar: { color: T.amber, bg: T.amberBg, icon: '👀', label: 'Revisar' },
  'en línea': { color: T.green, bg: T.greenBg, icon: '✅', label: 'En Línea' },
  soporte: { color: T.blue, bg: T.surface, icon: '🆘', label: 'Soporte' },
}

function AlertCard({ alert }) {
  const config = ALERT_CONFIG[alert.level] || ALERT_CONFIG.revisar
  return (
    <div style={{
      background: config.bg,
      border: `1px solid ${config.color}`,
      borderRadius: '8px',
      padding: '16px',
      display: 'flex',
      gap: '12px',
    }}>
      <div style={{ fontSize: '20px', minWidth: '24px' }}>
        {config.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: '12px',
          fontWeight: '700',
          color: config.color,
          marginBottom: '4px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {config.label}
        </div>
        <div style={{
          fontSize: '13px',
          color: T.textPri,
          marginBottom: '4px',
        }}>
          {alert.message}
        </div>
        {alert.detail && (
          <div style={{
            fontSize: '12px',
            color: T.textSec,
          }}>
            {alert.detail}
          </div>
        )}
      </div>
    </div>
  )
}

export function AlertsSection({ alerts = [] }) {
  // Ensure alerts is an array
  const alertsArray = Array.isArray(alerts) ? alerts : []

  if (!alertsArray || alertsArray.length === 0) {
    return (
      <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: '10px',
        padding: '32px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
        <p style={{ fontSize: '14px', color: T.textSec }}>
          No hay alertas. El equipo está en línea.
        </p>
      </div>
    )
  }

  // Group alerts by level
  const groupedAlerts = {}
  alertsArray.forEach((alert) => {
    if (!groupedAlerts[alert.level]) {
      groupedAlerts[alert.level] = []
    }
    groupedAlerts[alert.level].push(alert)
  })

  // Order by severity
  const order = ['crítico', 'atraso', 'revisar', 'en línea', 'soporte']
  const sortedLevels = Object.keys(groupedAlerts).sort(
    (a, b) => order.indexOf(a) - order.indexOf(b)
  )

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
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: T.amber }}>
          warning
        </span>
        <span style={{
          fontSize: '12px',
          fontWeight: '700',
          letterSpacing: '0.06em',
          color: T.textSec,
          textTransform: 'uppercase',
        }}>
          Alertas ({alertsArray.length})
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {sortedLevels.map((level) => (
          <div key={level}>
            {groupedAlerts[level].map((alert, idx) => (
              <AlertCard key={`${level}-${idx}`} alert={alert} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

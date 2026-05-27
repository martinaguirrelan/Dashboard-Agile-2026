// Team Capacity Distribution
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

function UtilizationBar({ utilization }) {
  let color = T.green
  if (utilization >= 85) color = T.red
  else if (utilization >= 75) color = T.amber
  else if (utilization >= 60) color = T.green

  return (
    <div style={{
      height: '6px',
      background: T.border,
      borderRadius: '3px',
      overflow: 'hidden',
      marginTop: '4px',
    }}>
      <div style={{
        height: '100%',
        width: `${Math.min(utilization, 100)}%`,
        background: color,
        transition: 'width 0.3s ease',
      }} />
    </div>
  )
}

function getMemberColor(utilization) {
  if (utilization >= 85) return T.red
  if (utilization >= 75) return T.amber
  return T.green
}

function getRoleColor(role) {
  const colors = {
    dev: T.blue,
    qa: T.amber,
    po: T.green,
    lt: T.amber,
    ux: '#a78bfa',
  }
  return colors[role] || T.textSec
}

function getRoleLabel(role) {
  const labels = {
    dev: 'Developer',
    qa: 'QA',
    po: 'Product Owner',
    lt: 'Tech Lead',
    ux: 'UX',
  }
  return labels[role] || role.toUpperCase()
}

export function CapacitySection({ team = [] }) {
  if (!team || team.length === 0) {
    return (
      <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: '10px',
        padding: '32px',
        textAlign: 'center',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: T.textMuted, marginBottom: 12, display: 'block' }}>
          group
        </span>
        <p style={{ fontSize: '14px', color: T.textSec }}>
          No hay datos de equipo disponibles
        </p>
      </div>
    )
  }

  // Calculate team stats
  const totalCapacity = team.reduce((sum, m) => sum + (m.estimacion || 0), 0)
  const totalUsed = team.reduce((sum, m) => sum + (m.horas_usadas || 0), 0)
  const avgUtilization = team.length > 0
    ? Math.round(team.reduce((sum, m) => sum + (m.utilization || 0), 0) / team.length)
    : 0

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
          people
        </span>
        <span style={{
          fontSize: '12px',
          fontWeight: '700',
          letterSpacing: '0.06em',
          color: T.textSec,
          textTransform: 'uppercase',
        }}>
          Distribución de Capacidad ({team.length})
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Team Members */}
        {team.map((member) => (
          <div key={member.id || member.nombre} style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: '16px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <div style={{ fontWeight: '600', color: T.textPri, marginBottom: '2px' }}>
                  {member.nombre || member.name}
                </div>
                <span style={{
                  fontSize: '11px',
                  color: getRoleColor(member.rol || member.role),
                  fontWeight: '600',
                  textTransform: 'uppercase',
                }}>
                  {getRoleLabel(member.rol || member.role)}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontWeight: '700',
                  color: getMemberColor(member.utilization || 0),
                  fontSize: '14px',
                }}>
                  {member.utilization || 0}%
                </div>
                <div style={{ fontSize: '11px', color: T.textSec, marginTop: '2px' }}>
                  {member.horas_usadas || 0}h / {member.estimacion || 0}h
                </div>
              </div>
            </div>
            <UtilizationBar utilization={member.utilization || 0} />
            {member.en_vacacion && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: T.amber }}>
                ✈️ En vacaciones
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer Summary */}
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
            {totalCapacity}h
          </div>
          <div style={{ fontSize: '10px', color: T.textMuted, marginTop: '4px' }}>Capacidad Total</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: T.green }}>
            {totalUsed}h
          </div>
          <div style={{ fontSize: '10px', color: T.textMuted, marginTop: '4px' }}>Utilizado</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: getMemberColor(avgUtilization) }}>
            {avgUtilization}%
          </div>
          <div style={{ fontSize: '10px', color: T.textMuted, marginTop: '4px' }}>Util. Promedio</div>
        </div>
      </div>
    </div>
  )
}

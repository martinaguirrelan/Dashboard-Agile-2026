// Team workload and utilization view
import React from 'react'

function UtilizationBar({ value, color = '#e65a35' }) {
  return (
    <div style={{
      height: '6px',
      background: 'var(--rule)',
      borderRadius: '3px',
      overflow: 'hidden',
      marginTop: '4px',
    }}>
      <div style={{
        height: '100%',
        width: `${value}%`,
        background: color,
        transition: 'width 0.3s ease',
      }} />
    </div>
  )
}

function getUtilizationColor(utilization) {
  if (utilization >= 85) return '#ef4444'
  if (utilization >= 75) return '#f59e0b'
  if (utilization >= 60) return '#22c55e'
  return '#3b82f6'
}

function getHealthEmoji(utilization) {
  if (utilization >= 85) return '⚠️'
  if (utilization >= 75) return '📊'
  return '✅'
}

export function TeamWorkload({ teamMembers }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: '8px', padding: '20px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--ink)' }}>
        Distribución de Carga de Trabajo
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {teamMembers.map((member) => (
          <div key={member.id} style={{ borderBottom: '1px solid var(--rule)', paddingBottom: '16px', fontSize: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', color: 'var(--ink)', marginBottom: '2px' }}>
                  {getHealthEmoji(member.utilization)} {member.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ink-60)' }}>{member.role}</div>
              </div>
              <div style={{ textAlign: 'right', minWidth: '100px' }}>
                <div style={{ fontWeight: '700', color: getUtilizationColor(member.utilization) }}>
                  {member.utilization}%
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ink-60)' }}>
                  {member.completedPoints}/{member.storyPoints} pts
                </div>
              </div>
            </div>
            <UtilizationBar value={member.utilization} color={getUtilizationColor(member.utilization)} />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              {member.skills.map((skill) => (
                <span
                  key={skill}
                  style={{
                    fontSize: '10px',
                    padding: '2px 8px',
                    background: 'var(--rule)',
                    borderRadius: '3px',
                    color: 'var(--ink-60)',
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid var(--rule)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent)' }}>
            {teamMembers.reduce((sum, m) => sum + m.storyPoints, 0)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--ink-60)', marginTop: '4px' }}>Story Points Totales</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#22c55e' }}>
            {teamMembers.reduce((sum, m) => sum + m.completedIssues, 0)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--ink-60)', marginTop: '4px' }}>Problemas Completados</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#f59e0b' }}>
            {Math.round(teamMembers.reduce((sum, m) => sum + m.utilization, 0) / teamMembers.length)}%
          </div>
          <div style={{ fontSize: '10px', color: 'var(--ink-60)', marginTop: '4px' }}>Util. Promedio</div>
        </div>
      </div>
    </div>
  )
}

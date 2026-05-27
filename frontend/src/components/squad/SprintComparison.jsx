// Sprint comparison and velocity trend
import React from 'react'

export function SprintComparison({ sprints }) {
  const sortedSprints = [...sprints].sort((a, b) => a.numero - b.numero)

  // Find max velocity for scaling
  const maxVelocity = Math.max(...sortedSprints.map(s => s.velocity))

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: '8px', padding: '20px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--ink)' }}>
        Comparación de Sprints & Tendencia de Velocidad
      </h3>

      {/* Velocity chart */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '120px', marginBottom: '12px' }}>
          {sortedSprints.map((sprint) => (
            <div key={sprint.numero} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              {/* Bar */}
              <div
                style={{
                  width: '100%',
                  height: `${(sprint.velocity / maxVelocity) * 100}px`,
                  background: sprint.status === 'active' ? 'var(--accent)' : '#3b82f6',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  opacity: 0.85,
                  minHeight: '4px',
                }}
                title={`${sprint.name}: ${sprint.velocity} pts`}
              />
              {/* Label */}
              <span style={{ fontSize: '10px', color: 'var(--ink-60)', textAlign: 'center', fontWeight: '500' }}>
                {sprint.velocity}
              </span>
              <span style={{ fontSize: '9px', color: 'var(--ink-60)', textAlign: 'center' }}>
                {sprint.name}
              </span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--ink-60)', textAlign: 'center' }}>
          Velocidad promedio: {Math.round(sortedSprints.reduce((sum, s) => sum + s.velocity, 0) / sortedSprints.length)} pts/sprint
        </div>
      </div>

      {/* Detailed table */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '12px',
      }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--rule)' }}>
            <th style={{ padding: '8px', textAlign: 'left', color: 'var(--ink-60)', fontWeight: '600' }}>Sprint</th>
            <th style={{ padding: '8px', textAlign: 'center', color: 'var(--ink-60)', fontWeight: '600' }}>Estado</th>
            <th style={{ padding: '8px', textAlign: 'center', color: 'var(--ink-60)', fontWeight: '600' }}>Problemas</th>
            <th style={{ padding: '8px', textAlign: 'center', color: 'var(--ink-60)', fontWeight: '600' }}>Story Points</th>
            <th style={{ padding: '8px', textAlign: 'center', color: 'var(--ink-60)', fontWeight: '600' }}>Finalización</th>
            <th style={{ padding: '8px', textAlign: 'center', color: 'var(--ink-60)', fontWeight: '600' }}>Velocidad</th>
          </tr>
        </thead>
        <tbody>
          {sortedSprints.map((sprint) => {
            const completionRate = Math.round((sprint.completedIssues / sprint.totalIssues) * 100)
            const pointsRate = Math.round((sprint.storyPointsCompleted / sprint.storyPointsPlanned) * 100)

            return (
              <tr key={sprint.numero} style={{ borderBottom: '1px solid var(--rule)' }}>
                <td style={{ padding: '12px 8px', fontWeight: '500', color: 'var(--ink)' }}>
                  {sprint.name}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    fontWeight: '600',
                    background: sprint.status === 'active' ? 'rgba(230, 90, 53, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                    color: sprint.status === 'active' ? 'var(--accent)' : '#22c55e',
                    textTransform: 'capitalize',
                  }}>
                    {sprint.status === 'active' ? 'Activo' : 'Completado'}
                  </span>
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                  {sprint.completedIssues}/{sprint.totalIssues}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                  {sprint.storyPointsCompleted}/{sprint.storyPointsPlanned}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '500' }}>
                  <span style={{
                    color: pointsRate >= 90 ? '#22c55e' : pointsRate >= 70 ? '#f59e0b' : '#ef4444'
                  }}>
                    {pointsRate}%
                  </span>
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '700', color: 'var(--accent)' }}>
                  {sprint.velocity}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Insights */}
      <div style={{
        marginTop: '20px',
        padding: '12px',
        background: 'rgba(230, 90, 53, 0.05)',
        borderRadius: '4px',
        fontSize: '12px',
        color: 'var(--ink-60)',
      }}>
        <strong style={{ color: 'var(--ink)' }}>📈 Insights:</strong> La velocidad ha aumentado de {sortedSprints[0].velocity} a {sortedSprints[sortedSprints.length - 1].velocity} pts en los últimos sprints. Se recomienda mantener el ritmo actual.
      </div>
    </div>
  )
}

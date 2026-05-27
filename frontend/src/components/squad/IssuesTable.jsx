// Issues/Initiatives table
import React from 'react'

const STATUS_COLORS = {
  'TERMINADO': { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', label: '✓ Terminado' },
  'EN PROCESO': { bg: 'rgba(230, 90, 53, 0.1)', color: 'var(--accent)', label: '→ En Proceso' },
  'POR INICIAR': { bg: 'rgba(96, 165, 250, 0.1)', color: '#60a5fa', label: '○ Por Iniciar' },
}

const TYPE_COLORS = {
  Epic: '#8b5cf6',
  Story: '#3b82f6',
  Request: '#06b6d4',
  Spike: '#f59e0b',
  Bug: '#ef4444',
  Subtask: '#6b7280',
}

export function IssuesTable({ issues = [], title = 'Iniciativas Recientes' }) {
  if (!issues || issues.length === 0) {
    return (
      <div style={{ background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: '8px', padding: '40px 20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--ink-60)' }}>No hay iniciativas para mostrar</p>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: '8px', padding: '20px', overflowX: 'auto' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--ink)' }}>
        {title}
      </h3>

      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '12px',
      }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--rule)' }}>
            <th style={{ padding: '10px', textAlign: 'left', color: 'var(--ink-60)', fontWeight: '600' }}>Clave</th>
            <th style={{ padding: '10px', textAlign: 'left', color: 'var(--ink-60)', fontWeight: '600' }}>Resumen</th>
            <th style={{ padding: '10px', textAlign: 'center', color: 'var(--ink-60)', fontWeight: '600' }}>Tipo</th>
            <th style={{ padding: '10px', textAlign: 'center', color: 'var(--ink-60)', fontWeight: '600' }}>Estado</th>
            <th style={{ padding: '10px', textAlign: 'center', color: 'var(--ink-60)', fontWeight: '600' }}>SP</th>
            <th style={{ padding: '10px', textAlign: 'center', color: 'var(--ink-60)', fontWeight: '600' }}>Asignado a</th>
            <th style={{ padding: '10px', textAlign: 'center', color: 'var(--ink-60)', fontWeight: '600' }}>Lead Time</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => {
            const statusInfo = STATUS_COLORS[issue.status] || STATUS_COLORS['POR INICIAR']

            return (
              <tr key={issue.key} style={{ borderBottom: '1px solid var(--rule)', hover: { background: 'rgba(0,0,0,0.02)' } }}>
                <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontWeight: '600', color: 'var(--accent)' }}>
                  {issue.key}
                </td>
                <td style={{ padding: '12px 10px', color: 'var(--ink)', maxWidth: '300px' }}>
                  <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', display: 'inline-block', maxWidth: '100%' }}>
                    {issue.summary}
                  </span>
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    fontWeight: '600',
                    background: `${TYPE_COLORS[issue.type] || '#6b7280'}15`,
                    color: TYPE_COLORS[issue.type] || '#6b7280',
                  }}>
                    {issue.type}
                  </span>
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    fontWeight: '600',
                    background: statusInfo.bg,
                    color: statusInfo.color,
                  }}>
                    {statusInfo.label}
                  </span>
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '600' }}>
                  {issue.storyPoints || '-'}
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'center', fontSize: '11px', color: 'var(--ink-60)' }}>
                  {issue.assignee?.split(' ')[0] || '-'}
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '600' }}>
                  {issue.leadTimeDays ? (
                    <span style={{ color: issue.leadTimeDays > 20 ? '#ef4444' : '#22c55e' }}>
                      {issue.leadTimeDays}d
                    </span>
                  ) : (
                    <span style={{ color: 'var(--ink-60)' }}>-</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

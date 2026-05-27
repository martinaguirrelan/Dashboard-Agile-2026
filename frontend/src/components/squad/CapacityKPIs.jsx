// KPI Cards for Squad Overview
import React from 'react'

function MetricCard({ label, value, unit = '', trend = null, color = '#e65a35' }) {
  return (
    <div style={{
      flex: '1 1 180px',
      minWidth: '160px',
      background: 'var(--bg)',
      border: '1px solid var(--rule)',
      borderRadius: '8px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      <span style={{ fontSize: '12px', color: 'var(--ink-60)', fontWeight: '500', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{ fontSize: '32px', fontWeight: '700', color, lineHeight: '1' }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: '14px', color: 'var(--ink-60)' }}>{unit}</span>}
      </div>
      {trend && (
        <span style={{ fontSize: '11px', color: trend > 0 ? '#22c55e' : '#ef4444' }}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs sprint anterior
        </span>
      )}
    </div>
  )
}

export function CapacityKPIs({ data }) {
  const completion = data.overview.totalIssues > 0
    ? Math.round((data.overview.completedIssues / data.overview.totalIssues) * 100)
    : 0

  const pointCompletion = data.overview.totalStoryPoints > 0
    ? Math.round((data.overview.completedStoryPoints / data.overview.totalStoryPoints) * 100)
    : 0

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '12px',
      marginBottom: '24px',
    }}>
      <MetricCard
        label="Problemas Completados"
        value={completion}
        unit="%"
        color="#22c55e"
        trend={+12}
      />
      <MetricCard
        label="Story Points"
        value={Math.round((data.overview.completedStoryPoints / data.overview.totalStoryPoints) * 100)}
        unit="%"
        color="#3b82f6"
        trend={+8}
      />
      <MetricCard
        label="Lead Time Promedio"
        value={data.overview.avgLeadTimeDays}
        unit="días"
        color="#f59e0b"
        trend={-5}
      />
      <MetricCard
        label="Miembros del Equipo"
        value={data.overview.teamSize}
        color="#8b5cf6"
      />
      <MetricCard
        label="Sprint Actual"
        value={data.overview.sprintProgress}
        unit="%"
        color="#e65a35"
      />
      <MetricCard
        label="Problemas Pendientes"
        value={data.overview.backlogIssues}
        color="#ef4444"
      />
    </div>
  )
}

// KPI Cards for Capacity Dashboard
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

function KPICard({ label, value, unit = '', icon, color = T.blue }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: '8px',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      flex: '1 1 180px',
      minWidth: '160px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{
          fontSize: '11px',
          fontWeight: '600',
          letterSpacing: '0.06em',
          color: T.textSec,
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
        {icon && (
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: T.textMuted }}>
            {icon}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{ fontSize: '36px', fontWeight: '700', color, lineHeight: '1' }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: '14px', color: T.textSec }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

export function CapacityKPIs({ computed }) {
  if (!computed) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
      }}>
        <KPICard label="Loading..." value="—" />
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '16px',
      marginBottom: '24px',
    }}>
      <KPICard
        label="Avance Padres"
        value={`${computed.avancePadres || 0}`}
        unit="%"
        color={T.green}
        icon="trending_up"
      />
      <KPICard
        label="Avance Horas"
        value={`${computed.avanceHoras || 0}`}
        unit="%"
        color={T.blue}
        icon="schedule"
      />
      <KPICard
        label="Horas Esperadas"
        value={`${computed.horasEsperadas || 0}`}
        unit="h"
        color={T.amber}
        icon="timer"
      />
      <KPICard
        label="Items Cerrados"
        value={`${computed.itemsCerrados || 0}`}
        color={T.green}
        icon="task_alt"
      />
      <KPICard
        label="Alertas"
        value={`${(computed.alertas || []).length}`}
        color={computed.alertas && computed.alertas.some(a => a.level === 'crítico') ? T.red : T.amber}
        icon="warning"
      />
    </div>
  )
}

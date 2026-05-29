import React from 'react'
import { AlertBadge } from './AlertBadge'
import { shortName, initials } from '../utils/capacityUtils'

export function AlertCard({ alert }) {
  return (
    <div className={`alert alert-${alert.level}`} style={{ marginBottom: '8px' }}>
      <div className="alert-head">
        <div className="alert-name">
          <span className="avatar">{initials(alert.name)}</span>
          <span>{shortName(alert.name)}</span>
        </div>
        <AlertBadge level={alert.level} />
      </div>
      <div className="alert-text">{alert.text}</div>
    </div>
  );
}

export function AlertsSection({ alertas }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div className="section-title">
        <h2>Alertas · acción recomendada</h2>
        <span className="line"></span>
        <span className="hint mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {alertas.length} personas
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {alertas.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px', color: 'var(--text-2)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p>No hay alertas. El equipo está en línea.</p>
          </div>
        ) : (
          alertas.map((alert, i) => (
            <AlertCard key={i} alert={alert} />
          ))
        )}
      </div>
    </div>
  );
}

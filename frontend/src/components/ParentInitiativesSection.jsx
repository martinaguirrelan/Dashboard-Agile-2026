import React from 'react'
import { AlertBadge } from './AlertBadge'

function ProgressBar({ current, max, height = 6 }) {
  const pct = max > 0 ? (current / max) * 100 : 0;
  const barColor = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div style={{
      height,
      background: 'var(--border)',
      borderRadius: '3px',
      overflow: 'hidden',
      marginTop: 8,
    }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: barColor,
        transition: 'width 0.3s',
      }} />
    </div>
  );
}

function ParentCard({ parent, items }) {
  const subs = items?.filter(i => i.pk === parent.k) || [];
  const done = subs.filter(i => i.s === 'TERMINADO').length;
  const total = subs.length || 1;

  return (
    <div className="card" style={{ padding: '12px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
        <div>
          <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)', margin: 0 }}>
            {parent.k}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-2)', margin: 0 }}>
            {parent.r}
          </p>
        </div>
        <AlertBadge level={parent._isDone ? 'linea' : 'atraso'} />
      </div>
      <ProgressBar current={done} max={total} />
    </div>
  );
}

export function ParentInitiativesSection({ S }) {
  if (!S.parents || S.parents.length === 0) return null;

  return (
    <div style={{ marginBottom: '24px' }}>
      <div className="section-title">
        <h2>Iniciativas padre — Progreso por subtareas</h2>
        <span className="line"></span>
        <span className="hint mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {S.parents.length} padres
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
        {S.parents.map((parent) => (
          <ParentCard key={parent.k} parent={parent} items={S.items} />
        ))}
      </div>
    </div>
  );
}

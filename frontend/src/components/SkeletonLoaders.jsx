import React from 'react'

export function SectionSkeleton({ title, itemCount = 3 }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div className="section-title">
        <h2>{title}</h2>
        <span className="line"></span>
        <span className="hint mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
          —
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
        {Array.from({ length: itemCount }).map((_, i) => (
          <div
            key={i}
            className="card"
            style={{
              padding: '12px',
              background: 'var(--border)',
              minHeight: '100px',
              borderRadius: '6px',
              animation: 'pulse 2s infinite',
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export function QuarterlySkeleton() {
  return (
    <div className="card quarterly-card" style={{ marginBottom: '24px' }}>
      <div className="card-head">
        <h3 style={{ background: 'var(--border)', height: '24px', borderRadius: '4px', animation: 'pulse 2s infinite' }}>&nbsp;</h3>
      </div>
      <div className="qtable">
        <div className="qtable-header" style={{ opacity: 0.5 }}>
          <span>KEY</span>
          <span>TIPO</span>
          <span>ESTADO</span>
          <span>NOMBRE</span>
          <span className="qth-bars">AVANCE REAL / ESPERADO</span>
          <span>SEMÁFORO</span>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 100px 100px 1fr 200px 60px',
              padding: '12px',
              borderBottom: '1px solid var(--border)',
              opacity: 0.5,
            }}
          >
            <div style={{ background: 'var(--border)', height: '16px', borderRadius: '2px' }} />
            <div style={{ background: 'var(--border)', height: '16px', borderRadius: '2px' }} />
            <div style={{ background: 'var(--border)', height: '16px', borderRadius: '2px' }} />
            <div style={{ background: 'var(--border)', height: '16px', borderRadius: '2px' }} />
            <div style={{ background: 'var(--border)', height: '16px', borderRadius: '2px' }} />
            <div style={{ background: 'var(--border)', height: '16px', borderRadius: '2px' }} />
          </div>
        ))}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export function AlertsSkeleton() {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div className="section-title">
        <h2>Alertas · acción recomendada</h2>
        <span className="line"></span>
        <span className="hint mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
          —
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="alert"
            style={{
              padding: '12px',
              background: 'var(--border)',
              minHeight: '80px',
              borderRadius: '6px',
              animation: 'pulse 2s infinite',
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

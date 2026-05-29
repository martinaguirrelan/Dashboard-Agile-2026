import React, { useState } from 'react'

function EpicDetailModal({ e, onClose }) {
  if (!e) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg)',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '600px',
        maxHeight: '80vh',
        overflow: 'auto',
      }} onClick={(ev) => ev.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>{e.key}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>
        <p style={{ color: 'var(--text-2)', marginBottom: '16px' }}>{e.nombre}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
          <div>
            <span style={{ color: 'var(--text-3)' }}>Estado</span>
            <p style={{ margin: '4px 0 0 0' }}>{e.estado}</p>
          </div>
          <div>
            <span style={{ color: 'var(--text-3)' }}>Iniciativa</span>
            <p style={{ margin: '4px 0 0 0' }}>{e.iniciativa || '—'}</p>
          </div>
          <div>
            <span style={{ color: 'var(--text-3)' }}>Avance Real</span>
            <p style={{ margin: '4px 0 0 0' }}>{e.pctReal.toFixed(1)}%</p>
          </div>
          <div>
            <span style={{ color: 'var(--text-3)' }}>Avance Esperado</span>
            <p style={{ margin: '4px 0 0 0' }}>{e.pctEsperado.toFixed(1)}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function QuarterlySection({ Q }) {
  const [open, setOpen] = useState(null);
  if (!Q || !Q.epics || Q.epics.length === 0) return null;

  return (
    <div className="card quarterly-card">
      <div className="card-head">
        <h3>Iniciativas trimestrales · Q2 2026 → 30/06</h3>
        <div className="quarterly-counters">
          <span className="qc-pill qc-init mono"><b>{Q.counters.porIniciar}</b> por iniciar</span>
          <span className="qc-pill qc-proc mono"><b>{Q.counters.enProceso}</b> en proceso</span>
          <span className="qc-pill qc-done mono"><b>{Q.counters.terminadas}</b> terminadas</span>
        </div>
      </div>
      <div className="qtable">
        <div className="qtable-header">
          <span>KEY</span>
          <span>TIPO</span>
          <span>ESTADO</span>
          <span>NOMBRE</span>
          <span className="qth-bars">AVANCE REAL / ESPERADO</span>
          <span>SEMÁFORO</span>
        </div>
        {Q.epics.map(e => (
          <div
            key={e.key}
            className={`qrow lvl-${e.level}`}
            onClick={() => setOpen(e)}
          >
            <span className="qrow-key mono">{e.key}</span>
            <span className="qrow-ini">{e.iniciativa || '—'}</span>
            <span className={`qrow-state state-${e.estado.toLowerCase().replace(/\s+/g,'-')}`}>{e.estado}</span>
            <span className="qrow-name" title={e.nombre}>{e.nombre}</span>
            <span className="qrow-bars">
              <span className="qrow-bar-line">
                <span className="qrow-bar-lbl">REAL</span>
                <span className="qrow-bar-track">
                  <span className={`qrow-bar-fill ${e.level}`} style={{ width: e.pctReal + '%' }}/>
                </span>
                <span className="qrow-bar-val mono">{e.pctReal.toFixed(0)}%</span>
              </span>
              <span className="qrow-bar-line">
                <span className="qrow-bar-lbl">ESP</span>
                <span className="qrow-bar-track">
                  <span className="qrow-bar-fill exp" style={{ width: e.pctEsperado + '%' }}/>
                </span>
                <span className="qrow-bar-val mono">{e.pctEsperado.toFixed(0)}%</span>
              </span>
            </span>
            <span className={`qrow-badge ${e.level}`}>
              {e.level === 'linea' && 'ÓPTIMO'}
              {e.level === 'medio' && 'DESV. MEDIA'}
              {e.level === 'critico' && 'CRÍTICO'}
              {e.level === 'vacio' && '—'}
            </span>
          </div>
        ))}
      </div>
      {open && <EpicDetailModal e={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

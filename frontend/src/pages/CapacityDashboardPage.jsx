import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getSquadCapacity, getSquadSprints } from '../api/capacity'
import { computeSprint, fmtHours, fmtDate, shortName, initials, todayISO } from '../utils/capacityUtils'
import '../styles/capacity-claude.css'

const HOURS_PER_DAY = 8;

function AlertBadge({ level }) {
  const levelMap = {
    critico: { class: 'danger', label: '🔴' },
    atraso: { class: 'warning', label: '🟠' },
    revisar: { class: 'warning', label: '🟡' },
    linea: { class: 'success', label: '🟢' },
    soporte: { class: 'info', label: '⚙️' },
  };
  const config = levelMap[level] || levelMap.linea;
  return (
    <span className={`alert-title-badge ${level}`}>
      {config.label} {level}
    </span>
  );
}

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Cargando dashboard...</p>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
      <div className="card" style={{ textAlign: 'center', maxWidth: '400px', padding: '40px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 8 }}>Error al cargar</p>
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 20 }}>{error}</p>
        <button
          onClick={onRetry}
          style={{
            padding: '8px 16px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

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

function Header({ squad, sprint, sprints, onSprintChange, loading, S }) {
  if (!S) return null;

  const sp = S.sp;
  const pct = sp.efectivos ? (S.diasTranscurridos / sp.efectivos) * 100 : 0;

  return (
    <header className="hdr">
      <div className="hdr-titleblock">
        <div className="hdr-eyebrow">
          <span className="dot"></span>
          <span>SPRINT {sp.num} · {sp.rango} · {sp.efectivos} días efectivos</span>
        </div>
        <h1 className="hdr-title">{squad?.squad || 'Squad'} · Capacity ejecutivo</h1>
        <div className="hdr-sub">
          <span>{S.team.filter(t=>t.role==='dev').length} devs</span>
          <span className="div">·</span>
          <span>{S.team.filter(t=>t.role==='qa').length} QA</span>
          <span className="div">·</span>
          <span>{S.team.filter(t=>t.role==='ux').length} UX</span>
          <span className="div">·</span>
          <span>{S.team.filter(t=>t.role==='soporte').length} soporte</span>
          <span className="div">·</span>
          <span>{S.items.length} items · {S.parents.length} padres</span>
        </div>
        <div className="sprint-bar">
          <span className="sprint-bar-label">SPRINT</span>
          <div className="sprint-bar-track">
            <div className="sprint-bar-fill" style={{ width: pct + '%' }}/>
          </div>
          <div className="sprint-bar-marks mono">
            <b>{S.diasTranscurridos}</b><span>/{sp.efectivos} días</span>
            <span style={{ color: 'var(--border)', margin: '0 6px' }}>·</span>
            <b>{S.pctEsperado}</b><span>% esperado</span>
          </div>
        </div>
      </div>
      <div className="hdr-meta">
        <div className="sprint-selector">
          <span className="sprint-selector-label">SPRINT</span>
          <div className="sprint-selector-tabs">
            {sprints.map(n => (
              <button
                key={n.num}
                className={`sprint-tab ${n.num === sprint ? 'active' : ''} ${n.num === 4 ? 'current' : ''}`}
                onClick={() => onSprintChange(n.num)}
                disabled={loading}
              >
                S{n.num}
              </button>
            ))}
          </div>
        </div>
        <span className="hdr-pill">Cap. máx <b>{sp.capMaxDias}d · {sp.capMaxHoras}h</b></span>
      </div>
    </header>
  );
}


function GaugeRing({ value, max = 100, color, size = 44 }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const pct = Math.min(Math.max(value, 0) / max, 1);
  return (
    <svg width={size} height={size} className="gauge" style={{ position: 'absolute', top: '12px', right: '12px' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="3"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset 1s ease-out" }}/>
    </svg>
  );
}

// SVG Donut helper
function donutPath(cx, cy, r, startA, endA) {
  const a0 = (startA - 90) * Math.PI / 180;
  const a1 = (endA - 90) * Math.PI / 180;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = endA - startA > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

function Donut({ data, size = 130, hole = 0.62, colors }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const r = size / 2;
  let cum = 0;
  const segs = data.map((d, i) => {
    const start = (cum / total) * 360;
    cum += d.count;
    const end = (cum / total) * 360;
    return { start, end, color: colors[i % colors.length], d };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut">
      {segs.map((s, i) => (
        <path key={i} d={donutPath(r, r, r - 1, s.start, Math.min(s.end, s.start + 359.99))} fill={s.color} />
      ))}
      <circle cx={r} cy={r} r={r * hole} fill="var(--surface)" />
      <text x={r} y={r - 4} textAnchor="middle" fill="var(--text)" fontFamily="var(--font-mono)" fontSize="22" fontWeight="500">{total}</text>
      <text x={r} y={r + 12} textAnchor="middle" fill="var(--text-3)" fontFamily="var(--font-mono)" fontSize="9" letterSpacing="1.2">TOTAL</text>
    </svg>
  );
}

function KPIs({ S }) {
  const hTotal = (S?.hTotalSec || 0) / 3600;
  const hDone = (S?.hDoneSec || 0) / 3600;
  const horasEsperadas = hTotal * (S?.pctEsperado || 0) / 100;
  const desvH = (S?.avanceHoras || 0) - (S?.pctEsperado || 0);
  const desvP = (S?.avancePadres || 0) - (S?.pctEsperado || 0);
  const criticas = S?.alertas?.filter(a => a.level === 'critico').length || 0;
  const atrasos = S?.alertas?.filter(a => a.level === 'atraso').length || 0;

  const getKpiClass = (desv) => {
    if (desv < -5) return 'warn';
    if (desv > 5) return 'good';
    return 'neutral';
  };

  const getTrendClass = (desv) => {
    if (desv < -5) return 'down';
    if (desv > 5) return 'up';
    return 'flat';
  };

  const getTrendColor = (desv) => {
    if (desv < -5) return 'var(--danger)';
    if (desv > 5) return 'var(--success)';
    return 'var(--accent)';
  };

  return (
    <div className="kpis">
      {/* Avance Padres */}
      <div className={`kpi ${getKpiClass(desvP)}`}>
        <div className="kpi-label"><span>AVANCE REAL · PADRES</span></div>
        <GaugeRing value={S?.avancePadres || 0} max={100} color={getTrendColor(desvP)} />
        <div className="kpi-value mono">{(S?.avancePadres || 0).toFixed(1)}%</div>
        <div className="kpi-sub">
          <span className={`kpi-trend ${getTrendClass(desvP)}`}>
            {desvP >= 0 ? '+' : ''}{desvP.toFixed(1)}pp
          </span>
          <span>vs {S?.pctEsperado || 0}% esperado</span>
        </div>
        <div className="kpi-foot mono">{S?.padresDone || 0} / {S?.padresTotal || 0} padres terminados</div>
      </div>

      {/* Avance Horas */}
      <div className={`kpi ${getKpiClass(desvH)}`}>
        <div className="kpi-label">AVANCE REAL · HORAS</div>
        <GaugeRing value={S?.avanceHoras || 0} max={100} color={getTrendColor(desvH)} />
        <div className="kpi-value mono">{(S?.avanceHoras || 0).toFixed(1)}%</div>
        <div className="kpi-sub">
          <span className={`kpi-trend ${getTrendClass(desvH)}`}>
            {desvH >= 0 ? '+' : ''}{desvH.toFixed(1)}pp
          </span>
          <span>vs {S?.pctEsperado || 0}% esperado</span>
        </div>
        <div className="kpi-foot mono">{hDone.toFixed(0)}h / {hTotal.toFixed(0)}h estimadas</div>
      </div>

      {/* Horas Esperadas */}
      <div className="kpi neutral">
        <div className="kpi-label">HORAS ESPERADAS</div>
        <GaugeRing value={horasEsperadas > 0 ? (hDone / horasEsperadas) * 100 : 0} max={100} color="var(--accent)"/>
        <div className="kpi-value mono">{hDone.toFixed(0)}<span style={{ fontSize: 16, color: 'var(--text-3)' }}> / {horasEsperadas.toFixed(0)}h</span></div>
        <div className="kpi-sub mono">objetivo a la fecha · {S?.pctEsperado || 0}% del total ({hTotal.toFixed(0)}h)</div>
      </div>

      {/* Items Cerrados */}
      <div className="kpi neutral">
        <div className="kpi-label">ITEMS CERRADOS</div>
        <div className="kpi-value mono">{S?.padresDone || 0}<span style={{ fontSize: 16, color: 'var(--text-3)' }}> / {S?.padresTotal || 0}</span></div>
        <div className="kpi-sub mono">
          {(S?.padresTotal || 0) > 0 ? ((S?.padresDone || 0) / (S?.padresTotal || 0) * 100).toFixed(1) : '0'}% · 0 bloqueados
        </div>
      </div>

      {/* Alertas Críticas */}
      <div className="kpi warn">
        <div className="kpi-label">ALERTAS CRÍTICAS</div>
        <div className="kpi-value mono">{criticas}<span style={{ fontSize: 16, color: 'var(--text-3)' }}> + {atrasos} atraso</span></div>
        <div className="kpi-sub">acción inmediata</div>
      </div>
    </div>
  );
}

function CapacityRow({ p, active, onClick, S, onOpenParents }) {
  const stats = p.items || [];
  const done = stats.filter(it => it.s === 'TERMINADO').length;
  const proc = stats.filter(it => /PROCESO|CERTIFIC|GESTION|ANALIS|VALIDA|PRUEBAS/i.test(it.s)).length;
  const block = stats.filter(it => it.s === 'BLOQUEADOS').length;
  const init = stats.filter(it => it.s === 'POR INICIAR').length;
  const tot = stats.length;
  const seg = (n) => tot ? (n/tot*100) : 0;
  const roleBadge = { dev: 'DEV', qa: 'QA', ux: 'UX', soporte: 'SOPORTE', lt: 'LT', po: 'PO' }[p.role] || p.role.toUpperCase();
  const parentsCount = p.parentsAssigned ? p.parentsAssigned.length : 0;

  return (
    <div className={`cap-row lvl-${p.alertaLevel} ${active ? 'active' : ''} ${p.role === 'soporte' ? 'soporte' : ''} ${p.role === 'lt' ? 'is-lt' : ''}`} onClick={onClick}>
      <div className="avatar">{p.initials}</div>
      <div className="cap-person">
        <div className="cap-name">
          {p.short}
          <span className={`role-chip role-${p.role}`}>{roleBadge}</span>
        </div>
        {p.nota && <div className="cap-note">{p.nota}</div>}
        {!p.nota && <div className="cap-note">{p.itemCount} items · {fmtHours(p.estTotalSec)}</div>}
      </div>
      <div className="cap-days">
        <small>CAP</small>
        {(p.estTotalSec/3600/HOURS_PER_DAY).toFixed(1)}d/{p.capDias}d
        {p.vacImpact > 0 && <div className="cap-vac mono">vac −{p.vacImpact}d</div>}
      </div>
      <div className="cap-progress">
        <div className="cap-progress-row">
          <span className="cap-progress-label">ESP</span>
          <div className="cap-progress-track">
            <div className="cap-progress-fill exp" style={{ width: S.pctEsperado + '%' }}/>
          </div>
          <span className="cap-progress-val">{S.pctEsperado}%</span>
        </div>
        <div className="cap-progress-row">
          <span className="cap-progress-label">REAL</span>
          <div className="cap-progress-track">
            <div className={`cap-progress-fill real ${p.alertaLevel}`} style={{ width: p.pctReal + '%' }}/>
          </div>
          <span className="cap-progress-val">{p.pctReal.toFixed(1)}%</span>
        </div>
      </div>
      <div className="cap-items">
        <div className="cap-items-numbers">
          <span><b>{done}</b> done</span>
          <span><b>{proc}</b> proc</span>
          <span><b>{init}</b> pend</span>
          {block > 0 && <span style={{ color: 'var(--danger)' }}><b>{block}</b> bloq</span>}
        </div>
        <div className="cap-items-bar">
          {done > 0 && <div className="seg done" style={{ width: seg(done) + '%' }}/>}
          {proc > 0 && <div className="seg proc" style={{ width: seg(proc) + '%' }}/>}
          {init > 0 && <div className="seg init" style={{ width: seg(init) + '%' }}/>}
          {block > 0 && <div className="seg block" style={{ width: seg(block) + '%' }}/>}
        </div>
      </div>
      <button
        type="button"
        className={`cap-parents ${parentsCount === 0 ? 'is-empty' : ''}`}
        onClick={(ev) => { ev.stopPropagation(); if (parentsCount > 0) onOpenParents(p); }}
        title={parentsCount > 0 ? 'Ver tarjetas padre asignadas' : 'Sin tarjetas padre asignadas'}
      >
        <span className="cap-parents-num mono">{parentsCount}</span>
        <span className="cap-parents-lbl">padres</span>
      </button>
      <div className="cap-status">
        <span className={`cap-badge ${p.alertaLevel}`}>{p.alertaTitle}</span>
        <span className={`cap-desv ${p.alertaLevel}`}>
          {p.role === 'soporte' ? '—' : (p.desv >= 0 ? '+' : '') + p.desv.toFixed(1) + 'pp'}
        </span>
      </div>
    </div>
  );
}

function CapacityDetail({ p }) {
  const items = p.items || [];
  const stateOrder = { 'TERMINADO': 0, 'EN PROCESO': 1, 'CERTIFICACION': 1, 'GESTION DEL PASE': 1, 'ANALISIS': 1, 'BLOQUEADOS': 2, 'POR INICIAR': 3 };
  const sorted = [...items].sort((a,b) => (stateOrder[a.s]??99) - (stateOrder[b.s]??99));

  function stateCls(s) {
    if (s === 'TERMINADO') return 'done';
    if (s === 'BLOQUEADOS') return 'block';
    if (s === 'POR INICIAR') return 'init';
    return 'proc';
  }

  function stateLabel(s) {
    if (s === 'TERMINADO') return 'DONE';
    if (s === 'BLOQUEADOS') return 'BLOQ';
    if (s === 'POR INICIAR') return 'POR INIC';
    if (s === 'CERTIFICACION') return 'CERT';
    if (s === 'GESTION DEL PASE') return 'PASE';
    if (s === 'ANALISIS') return 'ANÁLISIS';
    return 'EN PROC';
  }

  const pendingSec = p.pendingSec || 0;

  return (
    <div className="cap-detail">
      <div className="cap-detail-section">
        <h4>Resumen</h4>
        <div className="cap-detail-stats">
          <div className="cap-detail-stat">
            <div className="cap-detail-stat-label">Estimación total</div>
            <div className="cap-detail-stat-value">{fmtHours(p.estTotalSec)}</div>
          </div>
          <div className="cap-detail-stat">
            <div className="cap-detail-stat-label">Capacity ajustada</div>
            <div className="cap-detail-stat-value">{p.capDias}d / {p.capHoras}h</div>
          </div>
          <div className="cap-detail-stat">
            <div className="cap-detail-stat-label">Completado</div>
            <div className="cap-detail-stat-value" style={{ color: 'var(--success)' }}>{fmtHours(p.doneSec)}</div>
          </div>
          <div className="cap-detail-stat">
            <div className="cap-detail-stat-label">Pendiente</div>
            <div className="cap-detail-stat-value">{fmtHours(pendingSec)}</div>
          </div>
          <div className="cap-detail-stat">
            <div className="cap-detail-stat-label">Vacaciones</div>
            <div className="cap-detail-stat-value">{p.vacImpact > 0 ? `−${p.vacImpact}d` : '—'}</div>
          </div>
          <div className="cap-detail-stat">
            <div className="cap-detail-stat-label">% Capacity</div>
            <div className="cap-detail-stat-value">{p.role === 'soporte' ? 'Ver Soporte Digital' : p.pctCap.toFixed(1) + '%'}</div>
          </div>
          <div className="cap-detail-stat">
            <div className="cap-detail-stat-label">% Avance Real</div>
            <div className="cap-detail-stat-value">{p.pctReal.toFixed(1)}%</div>
          </div>
          <div className="cap-detail-stat">
            <div className="cap-detail-stat-label">Sin estimación</div>
            <div className="cap-detail-stat-value">{p.sinEst || '—'}</div>
          </div>
        </div>
      </div>
      <div className="cap-detail-section">
        <h4>Items asignados ({items.length})</h4>
        <div className="detail-items">
          {sorted.map((it, i) => (
            <div key={i} className="detail-item">
              <span className="ticket">{it.k}</span>
              <span className="summary" title={it.r}>{it.r}</span>
              <span className="est">{it.e ? fmtHours(it.e) : '—'}</span>
              <span className={`state-tag ${stateCls(it.s)}`}>{stateLabel(it.s)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CapacitySection({ S }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="card">
      <div className="card-head">
        <h3>Capacity por persona</h3>
        <span className="hint">{S.team.length} integrantes · click para detalle</span>
      </div>
      <div className="cap-table">
        {S.team.map(p => (
          <React.Fragment key={p.name}>
            <CapacityRow
              p={p}
              S={S}
              active={selected === p.name}
              onClick={() => setSelected(selected === p.name ? null : p.name)}
              onOpenParents={() => {}}
            />
            {selected === p.name && <CapacityDetail p={p} />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function AlertCard({ alert }) {
  const levelColorMap = {
    critico: 'var(--danger)',
    atraso: 'var(--warning)',
    revisar: 'var(--warning)',
    soporte: 'var(--text-3)',
    linea: 'var(--success)',
  };

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

const initColors = ["var(--accent)", "var(--warning)", "var(--info)", "var(--success)", "var(--text-3)"];
const parentTypeColors = ["var(--accent)", "var(--info)", "var(--success)", "var(--warning)", "var(--danger)", "var(--text-3)"];

function IniciativasCard({ S }) {
  if (!S.iniciativas || S.iniciativas.length === 0) return null;
  return (
    <div className="card">
      <div className="card-head">
        <h3>Distribución por iniciativa</h3>
        <span className="hint mono">{S.parents.length} padres del sprint</span>
      </div>
      <div className="donut-row">
        <Donut data={S.iniciativas.map(i => ({ count: i.count, name: i.tipo }))} colors={initColors} />
        <div className="donut-legend">
          {S.iniciativas.map((i, idx) => (
            <div key={i.tipo} className="legend-row" title={i.desc}>
              <span className="swatch" style={{ background: initColors[idx] }}></span>
              <span className="name">{i.tipo}</span>
              <span className="count">{i.count}</span>
              <span className="pct">{i.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ParentTypeCard({ S }) {
  if (!S.universoPadre || S.universoPadre.length === 0) return null;
  const ini = S.parents.filter(p => !p._isDone && p._done === 0).length;
  const proc = S.parents.filter(p => !p._isDone && p._done > 0).length;
  const done = S.parents.filter(p => p._isDone).length;

  return (
    <div className="card">
      <div className="card-head">
        <h3>Tarjetas padre por tipo</h3>
        <span className="hint mono">{S.parents.length} padres del sprint</span>
      </div>
      <div className="parent-status-summary" style={{ marginBottom: '16px' }}>
        <span className="pss-pill pss-init mono"><b>{ini}</b> por iniciar</span>
        <span className="pss-pill pss-proc mono"><b>{proc}</b> en proceso</span>
        <span className="pss-pill pss-done mono"><b>{done}</b> terminadas</span>
      </div>
      <div className="donut-row">
        <Donut data={S.universoPadre.map(i => ({ count: i.count, name: i.tipo }))} colors={parentTypeColors} />
        <div className="donut-legend">
          {S.universoPadre.map((i, idx) => (
            <div key={i.tipo} className="legend-row">
              <span className="swatch" style={{ background: parentTypeColors[idx] }}></span>
              <span className="name">{i.tipo}</span>
              <span className="count">{i.count}</span>
              <span className="pct">{i.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ItemsStatusSection({ S }) {
  if (!S.universoItems) return null;
  const t = S.universoItems.total;
  const sub = S.universoItems.subtareas;
  const bug = S.universoItems.bugs;
  const safePct = (n, d) => d > 0 ? (n/d*100) : 0;

  return (
    <div className="card">
      <div className="card-head">
        <h3>Estado de items</h3>
        <span className="hint mono">{t.total} items · {sub.total} subs + {bug.total} bugs</span>
      </div>
      <div className="items-grid">
        <div className="items-stat done">
          <div className="items-stat-label">Terminados</div>
          <div className="items-stat-value">{t.done}</div>
          <div className="items-stat-sub">{safePct(t.done,t.total).toFixed(1)}% · {sub.done} sub · {bug.done} bug</div>
        </div>
        <div className="items-stat proc">
          <div className="items-stat-label">En proceso</div>
          <div className="items-stat-value">{t.proc}</div>
          <div className="items-stat-sub">{sub.proc} sub · {bug.proc} bug</div>
        </div>
        <div className="items-stat init">
          <div className="items-stat-label">Por iniciar</div>
          <div className="items-stat-value">{t.init}</div>
          <div className="items-stat-sub">{safePct(t.init,t.total).toFixed(1)}% del total</div>
        </div>
        <div className="items-stat block">
          <div className="items-stat-label">Bloqueados</div>
          <div className="items-stat-value">{t.block}</div>
          <div className="items-stat-sub">{t.block > 0 ? "requieren escalar" : "sin bloqueos"}</div>
        </div>
      </div>
      <div className="items-bar">
        {t.done > 0 && <div className="seg done" style={{ width: safePct(t.done,t.total) + "%" }}/>}
        {t.proc > 0 && <div className="seg proc" style={{ width: safePct(t.proc,t.total) + "%" }}/>}
        {t.init > 0 && <div className="seg init" style={{ width: safePct(t.init,t.total) + "%" }}/>}
        {t.block > 0 && <div className="seg block" style={{ width: safePct(t.block,t.total) + "%" }}/>}
      </div>
      <div className="items-split">
        <div className="items-split-row">
          <span>Subtareas</span>
          <div className="items-split-bar">
            {sub.done > 0 && <div className="seg done" style={{ width: safePct(sub.done,sub.total) + "%" }}/>}
            {sub.proc > 0 && <div className="seg proc" style={{ width: safePct(sub.proc,sub.total) + "%" }}/>}
            {sub.init > 0 && <div className="seg init" style={{ width: safePct(sub.init,sub.total) + "%" }}/>}
            {sub.block > 0 && <div className="seg block" style={{ width: safePct(sub.block,sub.total) + "%" }}/>}
          </div>
          <span><b>{sub.total}</b></span>
          <span style={{ color: "var(--text-3)" }}>{sub.sinEst} s/est</span>
        </div>
        <div className="items-split-row">
          <span>Bugs</span>
          <div className="items-split-bar">
            {bug.done > 0 && <div className="seg done" style={{ width: safePct(bug.done,bug.total) + "%" }}/>}
            {bug.proc > 0 && <div className="seg proc" style={{ width: safePct(bug.proc,bug.total) + "%" }}/>}
            {bug.init > 0 && <div className="seg init" style={{ width: safePct(bug.init,bug.total) + "%" }}/>}
            {bug.block > 0 && <div className="seg block" style={{ width: safePct(bug.block,bug.total) + "%" }}/>}
          </div>
          <span><b>{bug.total}</b></span>
          <span style={{ color: bug.sinEst > 0 ? "var(--danger)" : "var(--text-3)" }}>{bug.sinEst} s/est</span>
        </div>
      </div>
    </div>
  );
}

function EpicDetailModal({ e, onClose }) {
  const horasAcumH = (e.horasAcumSec || 0) / 3600;
  const horasInvH = (e.horasInvSec || 0) / 3600;
  const horasPct = horasAcumH > 0 ? (horasInvH / horasAcumH) * 100 : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-narrow" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">
              <span className="mono" style={{ color: 'var(--text-3)', marginRight: 8 }}>{e.key}</span>
              {e.nombre}
            </div>
            <div className="modal-sub">
              {e.iniciativa && <span>{e.iniciativa}</span>}
              {e.iniciativa && <span style={{ margin: '0 6px', color: 'var(--border)' }}>·</span>}
              <span className={`qrow-state state-${e.estado.toLowerCase().replace(/\s+/g,'-')}`} style={{ display: 'inline-block' }}>{e.estado}</span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: 20 }}>
          <div className="qdetail-grid">
            <div className="qdetail-stat">
              <div className="qdetail-label">FECHA INICIO</div>
              <div className="qdetail-value mono">{e.sd ? fmtDate(e.sd) : '—'}</div>
            </div>
            <div className="qdetail-stat">
              <div className="qdetail-label">FECHA VENCIMIENTO</div>
              <div className="qdetail-value mono">{e.due ? fmtDate(e.due) : '—'}</div>
            </div>
            <div className="qdetail-stat">
              <div className="qdetail-label">FECHA DONE</div>
              <div className="qdetail-value mono" style={{ color: e.fd ? 'var(--success)' : 'var(--text-3)' }}>
                {e.fd ? fmtDate(e.fd) : '—'}
              </div>
            </div>
            <div className="qdetail-stat">
              <div className="qdetail-label">RESPONSABLE</div>
              <div className="qdetail-value">{shortName(e.asignado)}</div>
            </div>
            <div className="qdetail-stat">
              <div className="qdetail-label">PADRES AVANZADOS / TOTAL</div>
              <div className="qdetail-value mono"><b>{e.done}</b> / {e.total}</div>
            </div>
            <div className="qdetail-stat">
              <div className="qdetail-label">DESVIACIÓN</div>
              <div className={`qdetail-value mono qr-desv ${e.level}`}>
                {e.desv >= 0 ? '+' : ''}{e.desv.toFixed(1)}pp
              </div>
            </div>
            <div className="qdetail-stat">
              <div className="qdetail-label">RATIO REAL/ESP</div>
              <div className={`qdetail-value mono qr-desv ${e.level}`}>{(e.ratio * 100).toFixed(0)}%</div>
            </div>
            <div className="qdetail-stat">
              <div className="qdetail-label">% AVANCE REAL</div>
              <div className="qdetail-value mono">{e.pctReal.toFixed(1)}%</div>
            </div>
          </div>

          <div className="qdetail-section">
            <div className="qdetail-section-title">Progreso vs línea de tiempo</div>
            <div className="qdetail-bars">
              <div className="qrow-bar-line lg">
                <span className="qrow-bar-lbl">REAL</span>
                <span className="qrow-bar-track">
                  <span className={`qrow-bar-fill ${e.level}`} style={{ width: e.pctReal + '%' }}/>
                </span>
                <span className="qrow-bar-val mono">{e.pctReal.toFixed(0)}%</span>
              </div>
              <div className="qrow-bar-line lg">
                <span className="qrow-bar-lbl">ESPERADO</span>
                <span className="qrow-bar-track">
                  <span className="qrow-bar-fill exp" style={{ width: e.pctEsperado + '%' }}/>
                </span>
                <span className="qrow-bar-val mono">{e.pctEsperado.toFixed(0)}%</span>
              </div>
            </div>
          </div>

          <div className="qdetail-section">
            <div className="qdetail-section-title">Horas — subtareas + bugs asociados</div>
            <div className="qdetail-hours">
              <div className="qhour-card">
                <div className="qhour-label">ACUMULADAS (TOTAL ESTIMADAS)</div>
                <div className="qhour-value mono">{horasAcumH.toFixed(1)}<span>h</span></div>
              </div>
              <div className="qhour-card">
                <div className="qhour-label">INVERTIDAS (EN TERMINADAS)</div>
                <div className="qhour-value mono" style={{ color: 'var(--success)' }}>{horasInvH.toFixed(1)}<span>h</span></div>
              </div>
              <div className="qhour-card">
                <div className="qhour-label">% INVERSIÓN</div>
                <div className="qhour-value mono">{horasPct.toFixed(1)}<span>%</span></div>
              </div>
            </div>
            <div className="qhour-bar-track">
              <div className={`qhour-bar-fill ${e.level}`} style={{ width: horasPct + '%' }}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuarterlySection({ Q }) {
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

export default function CapacityDashboardPage() {
  const { projectKey } = useParams();
  const [data, setData] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch sprints
  useEffect(() => {
    const fetchSprints = async () => {
      try {
        const response = await getSquadSprints(projectKey);
        setSprints(response.sprints || []);
        setSelectedSprint(4);
      } catch (err) {
        console.error('Error fetching sprints:', err);
        setSprints([
          { num: 1, name: 'Sprint 1', rango: '08/04 – 21/04' },
          { num: 2, name: 'Sprint 2', rango: '22/04 – 05/05' },
          { num: 3, name: 'Sprint 3', rango: '06/05 – 19/05' },
          { num: 4, name: 'Sprint 4', rango: '20/05 – 02/06' },
        ]);
        setSelectedSprint(4);
      }
    };

    if (projectKey) {
      fetchSprints();
    }
  }, [projectKey]);

  // Fetch dashboard data
  useEffect(() => {
    const fetchData = async () => {
      if (!projectKey || selectedSprint === null) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await getSquadCapacity(projectKey, selectedSprint);
        setData(response);
      } catch (err) {
        console.error('Error fetching capacity data:', err);
        setError(err.message || 'Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [projectKey, selectedSprint]);

  // Compute sprint metrics
  const S = useMemo(() => {
    if (!data) return null;
    return computeSprint(data, data.config, selectedSprint, false);
  }, [data, selectedSprint]);

  // Compute quarterly data
  const Q = useMemo(() => {
    if (!data || !data.quarterly) return null;
    const q = data.quarterly;
    return {
      counters: {
        porIniciar: q.epics?.filter(e => e.estado === 'Por Iniciar').length || 0,
        enProceso: q.epics?.filter(e => e.estado === 'En Proceso').length || 0,
        terminadas: q.epics?.filter(e => e.estado === 'Terminado').length || 0,
      },
      epics: q.epics || [],
    };
  }, [data]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={() => setLoading(true)} />;
  if (!data || !S) return <ErrorState error="No hay datos disponibles" onRetry={() => setLoading(true)} />;

  const alertas = S.alertas || [];

  return (
    <>
        {/* Header */}
        <Header squad={data.config} sprint={selectedSprint} sprints={sprints} onSprintChange={setSelectedSprint} loading={loading} S={S} />

        {/* KPIs */}
        <KPIs S={S} />

        {/* Team Capacity + Distribution Cards - 2 Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.62fr) minmax(0, 1fr)', gap: '24px', marginBottom: '24px', alignItems: 'start' }}>
          <div>
            <CapacitySection S={S} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <IniciativasCard S={S} />
            <ParentTypeCard S={S} />
            <ItemsStatusSection S={S} />
          </div>
        </div>


        {/* Alerts Section */}
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

        {/* Parents */}
        {S.parents && S.parents.length > 0 && (
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
        )}

        {/* Quarterly Section */}
        {Q && <QuarterlySection Q={Q} />}
    </>
  );
}

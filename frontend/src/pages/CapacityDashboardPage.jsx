import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getSquadCapacity, getSquadSprints } from '../api/capacity'
import { computeSprint, fmtHours, fmtDate, shortName, initials, todayISO } from '../utils/capacityUtils'
import '../styles/capacity-claude.css'

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

function Header({ squad, sprint, sprints, onSprintChange, loading }) {
  return (
    <div className="hdr" style={{ marginBottom: '24px' }}>
      <div className="hdr-titleblock">
        <div className="hdr-eyebrow">
          <span className="dot"></span>
          CAPACITY DASHBOARD
        </div>
        <h1 className="hdr-title">{squad?.squad || 'Squad'}</h1>
        <p className="hdr-sub">Monitoreo de capacidad y utilización del equipo</p>
      </div>

      <div className="hdr-meta">
        <div className="sprint-selector">
          <label className="sprint-selector-label">Sprint Actual</label>
          <div className="sprint-selector-tabs">
              {sprints.map((s) => (
                <button
                  key={s.num}
                  className={`sprint-tab ${sprint === s.num ? 'active' : ''} ${s.num === 4 ? 'current' : ''}`}
                  onClick={() => onSprintChange(s.num)}
                  disabled={loading}
                >
                  S{s.num}
                </button>
              ))}
            </div>
        </div>
      </div>
    </div>
  );
}

function KPIs({ S }) {
  const kpis = [
    { label: 'Avance Padres', value: S?.avancePadres.toFixed(1), unit: '%' },
    { label: 'Avance Horas', value: S?.avanceHoras.toFixed(1), unit: '%' },
    { label: 'Horas Esperadas', value: `${Math.round((S?.hTotalSec || 0) / 3600)}`, unit: 'h' },
    { label: 'Items Cerrados', value: S?.padresDone, unit: `/${S?.padresTotal}` },
    { label: 'Alertas Críticas', value: S?.alertas?.filter(a => a.level === 'critico').length || 0, unit: '' },
  ];

  return (
    <div className="kpis" style={{ marginBottom: '24px' }}>
      {kpis.map((kpi, i) => (
        <div key={i} className="kpi">
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '8px' }}>
            {kpi.label}
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--accent)' }}>
            {kpi.value || '0'}<span style={{ fontSize: '16px', marginLeft: '4px' }}>{kpi.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamCard({ member }) {
  return (
    <div className="card" style={{ padding: '16px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
        <div>
          <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', margin: 0, marginBottom: '4px' }}>
            {shortName(member.name)}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: 0 }}>
            {member.role.toUpperCase()} • {member.itemCount} items • {fmtHours(member.estTotalSec)}
          </p>
        </div>
        <AlertBadge level={member.alertaLevel} />
      </div>
      <ProgressBar current={member.pctReal} max={100} />
      <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-2)', marginTop: '8px' }}>
        <span>Avance: {member.pctReal.toFixed(0)}%</span>
        <span>Cap: {member.pctCap.toFixed(0)}%</span>
        <span>Vac: {member.vacImpact}d</span>
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

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={() => setLoading(true)} />;
  if (!data || !S) return <ErrorState error="No hay datos disponibles" onRetry={() => setLoading(true)} />;

  const alertas = S.alertas || [];

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Back link */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 24px' }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-2)',
            fontSize: '13px',
            textDecoration: 'none',
          }}
        >
          ← Volver al Dashboard
        </Link>
      </div>

      <div style={{ maxWidth: '1480px', margin: '0 auto', padding: '28px 32px' }}>
        {/* Header */}
        <Header squad={data.config} sprint={selectedSprint} sprints={sprints} onSprintChange={setSelectedSprint} loading={loading} />

        {/* KPIs */}
        <KPIs S={S} />

        {/* Main content */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          {/* Team Capacity */}
          <div>
            <div className="section-title">
              <h2>Distribución de Capacidad</h2>
              <span className="line"></span>
              <span className="hint mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {S.team?.length || 0} personas
              </span>
            </div>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {S.team?.map((member) => (
                <TeamCard key={member.name} member={member} />
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div>
            <div className="section-title">
              <h2>Alertas · acción recomendada</h2>
              <span className="line"></span>
              <span className="hint mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {alertas.length} personas
              </span>
            </div>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {alertas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-2)' }}>
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
      </div>
    </div>
  );
}

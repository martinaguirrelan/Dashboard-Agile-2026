import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getSquadCapacity, getSquadSprints } from '../api/capacity'
import { computeSprint, fmtHours, fmtDate, shortName, initials, todayISO } from '../utils/capacityUtils'

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

function AlertBadge({ level }) {
  const colors = {
    critico: { bg: '#7f1d1d', text: '#fca5a5' },
    atraso: { bg: '#7c2d12', text: '#fed7aa' },
    revisar: { bg: '#1f2937', text: '#9ca3af' },
    linea: { bg: '#065f46', text: '#a7f3d0' },
    soporte: { bg: '#1f2937', text: '#d1d5db' },
  };
  const color = colors[level] || colors.linea;
  return (
    <span style={{
      display: 'inline-block',
      background: color.bg,
      color: color.text,
      padding: '2px 8px',
      borderRadius: '3px',
      fontSize: '11px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {level === 'critico' ? '🔴' : level === 'atraso' ? '🟠' : level === 'revisar' ? '🟡' : level === 'soporte' ? '⚙️' : '🟢'} {level}
    </span>
  );
}

function Loading() {
  return (
    <div style={{
      background: T.bg,
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <p style={{ color: T.textSec, fontSize: 14 }}>Cargando dashboard...</p>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div style={{
      background: T.bg,
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        textAlign: 'center',
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: '10px',
        padding: '40px',
        maxWidth: '400px',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <p style={{ fontSize: 14, color: T.textPri, marginBottom: 8 }}>Error al cargar</p>
        <p style={{ fontSize: 12, color: T.textSec, marginBottom: 20 }}>{error}</p>
        <button
          onClick={onRetry}
          style={{
            padding: '8px 16px',
            background: T.blue,
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
  return (
    <div style={{
      height,
      background: T.border,
      borderRadius: '3px',
      overflow: 'hidden',
      marginTop: 8,
    }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: pct >= 80 ? T.green : pct >= 50 ? T.amber : T.red,
        transition: 'width 0.3s',
      }} />
    </div>
  );
}

function Header({ squad, sprint, sprints, onSprintChange, loading }) {
  return (
    <div style={{
      background: T.surface,
      borderBottom: `1px solid ${T.border}`,
      padding: '24px',
      marginBottom: '24px',
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px',
      }}>
        <div>
          <p style={{ fontSize: '11px', color: T.textSec, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.08em' }}>
            CAPACITY DASHBOARD
          </p>
          <h1 style={{ fontSize: '32px', color: T.textPri, margin: 0, marginBottom: '8px', fontWeight: '700' }}>
            {squad?.squad || 'Squad'}
          </h1>
          <p style={{ fontSize: '13px', color: T.textSec, margin: 0 }}>
            Monitoreo de capacidad y utilización del equipo
          </p>
        </div>

        <div>
          <label style={{ fontSize: '11px', color: T.textSec, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            Sprint Actual
          </label>
          <select
            value={sprint || 4}
            onChange={(e) => onSprintChange(parseInt(e.target.value))}
            disabled={loading}
            style={{
              background: T.bg,
              color: T.textPri,
              border: `1px solid ${T.border}`,
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            {sprints.map((s) => (
              <option key={s.num} value={s.num}>
                Sprint {s.num} {s.rango && `(${s.rango})`}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function KPIs({ S }) {
  const kpis = [
    { label: 'Avance Padres', value: S?.avancePadres.toFixed(1), unit: '%', color: T.green },
    { label: 'Avance Horas', value: S?.avanceHoras.toFixed(1), unit: '%', color: T.blue },
    { label: 'Horas Esperadas', value: `${Math.round((S?.hTotalSec || 0) / 3600)}`, unit: 'h', color: T.amber },
    { label: 'Items Cerrados', value: S?.padresDone, unit: `/${S?.padresTotal}`, color: T.green },
    { label: 'Alertas Críticas', value: S?.alertas?.filter(a => a.level === 'critico').length || 0, unit: '', color: T.red },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
      marginBottom: '24px',
      maxWidth: '1400px',
      margin: '0 auto 24px',
      padding: '0 24px',
    }}>
      {kpis.map((kpi, i) => (
        <div
          key={i}
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: '10px',
            padding: '20px',
            borderLeft: `4px solid ${kpi.color}`,
          }}
        >
          <p style={{ fontSize: '11px', color: T.textSec, textTransform: 'uppercase', margin: 0, marginBottom: '8px' }}>
            {kpi.label}
          </p>
          <p style={{ fontSize: '28px', fontWeight: '700', color: kpi.color, margin: 0 }}>
            {kpi.value || '0'}<span style={{ fontSize: '16px', marginLeft: '4px' }}>{kpi.unit}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

function TeamCard({ member }) {
  const getAlertColor = (level) => {
    const colors = {
      critico: T.red,
      atraso: T.amber,
      revisar: '#fbbf24',
      linea: T.green,
      soporte: T.textMuted,
    };
    return colors[level] || T.textMuted;
  };

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
        <div>
          <p style={{ fontSize: '14px', fontWeight: '600', color: T.textPri, margin: 0, marginBottom: '4px' }}>
            {shortName(member.name)}
          </p>
          <p style={{ fontSize: '12px', color: T.textSec, margin: 0 }}>
            {member.role.toUpperCase()} • {member.itemCount} items • {fmtHours(member.estTotalSec)}
          </p>
        </div>
        <AlertBadge level={member.alertaLevel} />
      </div>
      <ProgressBar current={member.pctReal} max={100} />
      <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: T.textSec, marginTop: '8px' }}>
        <span>Avance: {member.pctReal.toFixed(0)}%</span>
        <span>Cap: {member.pctCap.toFixed(0)}%</span>
        <span>Vac: {member.vacImpact}d</span>
      </div>
    </div>
  );
}

function AlertCard({ alert }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '8px',
      borderLeft: `4px solid ${
        alert.level === 'critico' ? T.red :
        alert.level === 'atraso' ? T.amber :
        alert.level === 'revisar' ? '#fbbf24' :
        alert.level === 'soporte' ? T.textMuted :
        T.green
      }`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '4px' }}>
        <p style={{ fontSize: '12px', fontWeight: '600', color: T.textPri, margin: 0 }}>
          {alert.name}
        </p>
        <AlertBadge level={alert.level} />
      </div>
      <p style={{ fontSize: '12px', color: T.textSec, margin: 0, lineHeight: '1.4' }}>
        {alert.text}
      </p>
    </div>
  );
}

function ParentCard({ parent, items }) {
  const subs = items?.filter(i => i.pk === parent.k) || [];
  const done = subs.filter(i => i.s === 'TERMINADO').length;
  const total = subs.length || 1;

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
        <div>
          <p style={{ fontSize: '12px', fontWeight: '600', color: T.textPri, margin: 0 }}>
            {parent.k}
          </p>
          <p style={{ fontSize: '11px', color: T.textSec, margin: 0 }}>
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
  const criticalAlerts = alertas.filter(a => a.level === 'critico');

  return (
    <div style={{
      background: T.bg,
      minHeight: '100vh',
      paddingBottom: '40px',
    }}>
      {/* Back link */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '12px 24px' }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: T.textSec,
            fontSize: '13px',
            textDecoration: 'none',
          }}
        >
          ← Volver al Dashboard
        </Link>
      </div>

      {/* Header */}
      <Header squad={data.config} sprint={selectedSprint} sprints={sprints} onSprintChange={setSelectedSprint} loading={loading} />

      {/* KPIs */}
      <KPIs S={S} />

      {/* Main content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          {/* Team Capacity */}
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: '700', color: T.textPri, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
              Distribución de Capacidad ({S.team?.length || 0})
            </h2>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {S.team?.map((member) => (
                <TeamCard key={member.name} member={member} />
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: '700', color: T.textPri, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
              Alertas ({alertas.length})
            </h2>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {alertas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: T.textSec }}>
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
            <h2 style={{ fontSize: '14px', fontWeight: '700', color: T.textPri, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
              Iniciativas Trimestales ({S.parents.length})
            </h2>
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

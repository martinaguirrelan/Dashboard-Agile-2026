import { useMemo } from "react";
import { STATUS_COLORS } from "../../constants/capacityConstants";

const DonutChart = ({ data, title }) => {
  const total = Object.values(data).reduce((sum, val) => sum + val, 0);

  if (total === 0) {
    return (
      <div className="chart-item">
        <h3>{title}</h3>
        <div className="chart-empty">Sin datos</div>
      </div>
    );
  }

  const cx = 50;
  const cy = 50;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  const colors = [STATUS_COLORS["Hecho"], STATUS_COLORS["En Proceso"], STATUS_COLORS["Por Hacer"]];
  const labels = ["Hecho", "En Proceso", "Por Hacer"];
  const values = [data.done || 0, data.inProgress || 0, data.todo || 0];

  let currentAngle = 0;
  const paths = values.map((value, index) => {
    const percentage = value / total;
    const sliceAngle = percentage * 360;
    const startAngle = (currentAngle * Math.PI) / 180;
    const endAngle = ((currentAngle + sliceAngle) * Math.PI) / 180;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    const largeArc = sliceAngle > 180 ? 1 : 0;

    const pathData = [
      `M ${cx} ${cy}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      "Z",
    ].join(" ");

    currentAngle += sliceAngle;

    return { pathData, color: colors[index], label: labels[index], value, percentage };
  });

  return (
    <div className="chart-item">
      <h3>{title}</h3>
      <svg viewBox="0 0 100 100" className="donut-chart">
        {paths.map((path, idx) => (
          <path key={idx} d={path.pathData} fill={path.color} opacity="0.8" />
        ))}
      </svg>
      <div className="chart-legend">
        {paths.map((path, idx) => (
          <div key={idx} className="legend-item">
            <span className="legend-color" style={{ backgroundColor: path.color }} />
            <span className="legend-label">
              {path.label}: {path.value} ({Math.round(path.percentage * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SprintGauges = ({ sprintProgress, title }) => {
  const sprints = Object.entries(sprintProgress).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="chart-item">
      <h3>{title}</h3>
      <div className="gauges-grid">
        {sprints.map(([sprintKey, data]) => {
          const percentage = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
          return (
            <div key={sprintKey} className="gauge-item">
              <div className="gauge-title">{sprintKey}</div>
              <svg viewBox="0 0 100 120" className="gauge-svg">
                <circle cx="50" cy="60" r="40" fill="none" stroke="#e0e0e0" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="60"
                  r="40"
                  fill="none"
                  stroke="#27ae60"
                  strokeWidth="8"
                  strokeDasharray={`${(percentage / 100) * 251.3} 251.3`}
                />
                <text x="50" y="70" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#fff">
                  {percentage}%
                </text>
              </svg>
              <div className="gauge-stats">
                {data.done}/{data.total}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TeamLoadBars = ({ teamLoad, title }) => {
  const entries = Object.entries(teamLoad).sort((a, b) => (b[1].done + b[1].inProgress) - (a[1].done + a[1].inProgress));

  return (
    <div className="chart-item">
      <h3>{title}</h3>
      <div className="team-load-bars">
        {entries.map(([person, load]) => {
          const total = load.done + load.inProgress + load.todo;
          const donePercent = total > 0 ? (load.done / total) * 100 : 0;
          const inProgPercent = total > 0 ? (load.inProgress / total) * 100 : 0;

          return (
            <div key={person} className="load-bar-row">
              <span className="load-name">{person || "Sin Asignar"}</span>
              <div className="load-bar">
                <div
                  className="load-segment done"
                  style={{ width: `${donePercent}%` }}
                  title={`${load.done} SP Done`}
                />
                <div
                  className="load-segment in-progress"
                  style={{ width: `${inProgPercent}%` }}
                  title={`${load.inProgress} SP In Progress`}
                />
                <div
                  className="load-segment todo"
                  style={{ width: `${100 - donePercent - inProgPercent}%` }}
                  title={`${load.todo} SP To Do`}
                />
              </div>
              <span className="load-total">{total} SP</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function CapacityCharts({ chartData, loading = false }) {
  if (loading) {
    return <div className="charts-container loading">Generando gráficos...</div>;
  }

  if (!chartData) {
    return <div className="charts-container empty">Sin datos para gráficos</div>;
  }

  return (
    <div className="charts-container">
      <h2>Análisis Visual</h2>
      <div className="charts-grid">
        <DonutChart data={chartData.statusCounts} title="Distribución por Estado" />
        <SprintGauges sprintProgress={chartData.sprintProgress} title="Progreso por Sprint" />
        <TeamLoadBars teamLoad={chartData.teamLoad} title="Carga del Equipo (Story Points)" />
      </div>
    </div>
  );
}

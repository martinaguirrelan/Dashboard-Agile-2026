import { KPI_LABELS } from "../../constants/capacityConstants";

const KPICard = ({ label, value, delta, subtext }) => (
  <div className="kpi-card">
    <div className="kpi-header">
      <h3>{label}</h3>
      {delta !== undefined && (
        <span className={`kpi-delta ${delta >= 0 ? "positive" : "negative"}`}>
          {delta > 0 ? "+" : ""}{delta}%
        </span>
      )}
    </div>
    <div className="kpi-value">{value}</div>
    {subtext && <div className="kpi-subtext">{subtext}</div>}
  </div>
);

export default function KPICards({ metrics }) {
  if (!metrics) {
    return <div className="kpi-cards-grid">Loading...</div>;
  }

  const { parentsPercent, hoursPercent, estimado, items, alertas, deltaPercent } = metrics;

  return (
    <div className="kpi-cards-grid">
      <KPICard label={KPI_LABELS.parentsPercent} value={`${parentsPercent}%`} subtext="de historias padre" />
      <KPICard label={KPI_LABELS.hoursPercent} value={`${hoursPercent}%`} delta={deltaPercent} subtext="completado" />
      <KPICard label={KPI_LABELS.estimado} value={estimado} subtext="story points" />
      <KPICard label={KPI_LABELS.items} value={items} subtext="issues totales" />
      <KPICard
        label={KPI_LABELS.alertas}
        value={alertas}
        subtext={alertas > 0 ? "bloqueadores detectados" : "sin alertas"}
      />
    </div>
  );
}

import { QUARTER_OPTIONS } from "../../constants/capacityConstants";
import "../capacity/capacity.css";

export default function CapacityHeader({ selectedQuarter, selectedProject, projects, onQuarterChange, onProjectChange }) {
  return (
    <div className="capacity-header">
      <h1>Capacity Ejecutivo</h1>
      <div className="capacity-filters">
        <div className="filter-group">
          <label htmlFor="quarter-select">Trimestre</label>
          <select id="quarter-select" value={selectedQuarter} onChange={(e) => onQuarterChange(e.target.value)}>
            {QUARTER_OPTIONS.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>

        {projects && projects.length > 0 && (
          <div className="filter-group">
            <label htmlFor="project-select">Squad/Proyecto</label>
            <select id="project-select" value={selectedProject} onChange={(e) => onProjectChange(e.target.value)}>
              {projects.map((p) => (
                <option key={p.project_key} value={p.project_key}>
                  {p.project_name || p.project_key}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

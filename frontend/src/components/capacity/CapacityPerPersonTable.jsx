import { useState, useMemo } from "react";

const CapacityBar = ({ donePercent }) => (
  <div className="capacity-bar-container">
    <div className="capacity-bar">
      <div className="capacity-bar-fill done" style={{ width: `${donePercent}%` }} />
    </div>
    <span className="capacity-percent">{donePercent}%</span>
  </div>
);

const PersonRow = ({ person, isExpanded, onToggle }) => (
  <div key={person.name}>
    <tr className="person-row" onClick={() => onToggle(person.name)}>
      <td className="col-name">
        <span className="expand-indicator">{isExpanded ? "▼" : "▶"}</span>
        {person.name || "Sin Asignar"}
      </td>
      <td className="col-sprints">{person.sprints.join(", ") || "—"}</td>
      <td className="col-estimado text-right">{person.totalStoryPoints} SP</td>
      <td className="col-items text-center">{person.items}</td>
      <td className="col-capacity">
        <CapacityBar donePercent={person.donePercent} />
      </td>
      <td className="col-alerts text-center">
        {person.blockers > 0 && <span className="alert-badge">{person.blockers} 🚫</span>}
      </td>
    </tr>
    {isExpanded && person.issues && (
      <tr className="detail-row">
        <td colSpan="6">
          <div className="detail-content">
            <h4>Issues de {person.name || "Sin Asignar"}</h4>
            <ul className="issue-list">
              {person.issues.map((issue) => (
                <li key={issue.jira_issue_id} className="issue-item">
                  <span className="issue-key">{issue.jira_issue_id}</span>
                  <span className="issue-summary">{issue.summary}</span>
                  <span className="issue-sp">
                    {issue.story_points ? `${issue.story_points} SP` : "—"}
                  </span>
                  <span className={`issue-status ${issue.estado?.toLowerCase().includes("hecho") ? "done" : "pending"}`}>
                    {issue.estado || "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </td>
      </tr>
    )}
  </div>
);

export default function CapacityPerPersonTable({ capacity, loading = false }) {
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [sortColumn, setSortColumn] = useState("totalStoryPoints");
  const [sortDirection, setSortDirection] = useState("desc");

  const sortedCapacity = useMemo(() => {
    if (!capacity) return [];

    return [...capacity].sort((a, b) => {
      const aVal = a[sortColumn] || 0;
      const bVal = b[sortColumn] || 0;

      let comp;
      if (typeof aVal === "number") {
        comp = aVal - bVal;
      } else {
        comp = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === "asc" ? comp : -comp;
    });
  }, [capacity, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const toggleExpand = (personName) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(personName)) {
      newSet.delete(personName);
    } else {
      newSet.add(personName);
    }
    setExpandedRows(newSet);
  };

  if (loading) {
    return <div className="table-loading">Cargando capacidad...</div>;
  }

  if (!capacity || capacity.length === 0) {
    return <div className="table-empty">Sin datos de capacidad</div>;
  }

  return (
    <div className="capacity-table-container">
      <h2>Capacidad por Persona</h2>
      <table className="capacity-table">
        <thead>
          <tr>
            <th className="col-name" onClick={() => handleSort("name")}>
              Asignado {sortColumn === "name" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th className="col-sprints">Sprint(s)</th>
            <th className="col-estimado" onClick={() => handleSort("totalStoryPoints")}>
              Estimado {sortColumn === "totalStoryPoints" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th className="col-items" onClick={() => handleSort("items")}>
              Items {sortColumn === "items" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th className="col-capacity">Estado</th>
            <th className="col-alerts">Alertas</th>
          </tr>
        </thead>
        <tbody>
          {sortedCapacity.map((person) => (
            <PersonRow
              key={person.name}
              person={person}
              isExpanded={expandedRows.has(person.name)}
              onToggle={toggleExpand}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

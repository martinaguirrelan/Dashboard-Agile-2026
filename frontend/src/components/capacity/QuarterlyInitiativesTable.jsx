import { useState, useMemo } from "react";

const StatusBadge = ({ status }) => {
  const statusClass = status?.toLowerCase().includes("hecho")
    ? "status-done"
    : status?.toLowerCase().includes("proceso")
      ? "status-in-progress"
      : "status-todo";

  return <span className={`status-badge ${statusClass}`}>{status || "—"}</span>;
};

const IssueRow = ({ issue, isChild = false, onExpand }) => (
  <tr className={isChild ? "issue-row-child" : "issue-row"}>
    <td className="col-key">
      {!isChild && issue.children && issue.children.length > 0 && (
        <button className="expand-btn" onClick={() => onExpand(issue.jira_issue_id)}>
          ▶
        </button>
      )}
      <span className="issue-key">{issue.jira_issue_id}</span>
    </td>
    <td className="col-title" title={issue.summary}>
      {issue.summary}
    </td>
    <td className="col-type">
      <span className="type-badge">{issue.issue_type || "—"}</span>
    </td>
    <td className="col-sp text-right">{issue.story_points || "—"}</td>
    <td className="col-estado">
      <StatusBadge status={issue.estado} />
    </td>
    <td className="col-assignee">{issue.assignee || "—"}</td>
    <td className="col-sprint">{issue.sprint_key || "—"}</td>
    <td className="col-parent">{issue.parent_issue_key || "—"}</td>
  </tr>
);

export default function QuarterlyInitiativesTable({ issues, loading = false }) {
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [sortColumn, setSortColumn] = useState("jira_issue_id");
  const [sortDirection, setSortDirection] = useState("asc");

  const parentIssues = useMemo(() => {
    const parentMap = new Map();
    const roots = [];

    issues.forEach((issue) => {
      if (!issue.parent_issue_key) {
        const parent = { ...issue, children: [] };
        parentMap.set(issue.jira_issue_id, parent);
        roots.push(parent);
      }
    });

    issues.forEach((issue) => {
      if (issue.parent_issue_key) {
        const parent = parentMap.get(issue.parent_issue_key);
        if (parent) {
          parent.children.push(issue);
        }
      }
    });

    return roots.sort((a, b) => {
      const aVal = a[sortColumn] || "";
      const bVal = b[sortColumn] || "";
      const comp = String(aVal).localeCompare(String(bVal));
      return sortDirection === "asc" ? comp : -comp;
    });
  }, [issues, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const toggleExpand = (issueId) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(issueId)) {
      newSet.delete(issueId);
    } else {
      newSet.add(issueId);
    }
    setExpandedRows(newSet);
  };

  if (loading) {
    return <div className="table-loading">Cargando iniciativas...</div>;
  }

  return (
    <div className="initiatives-table-container">
      <h2>Iniciativas por Trimestre</h2>
      <table className="initiatives-table">
        <thead>
          <tr>
            <th className="col-key" onClick={() => handleSort("jira_issue_id")}>
              Key {sortColumn === "jira_issue_id" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th className="col-title" onClick={() => handleSort("summary")}>
              Título {sortColumn === "summary" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th className="col-type" onClick={() => handleSort("issue_type")}>
              Tipo {sortColumn === "issue_type" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th className="col-sp" onClick={() => handleSort("story_points")}>
              SP {sortColumn === "story_points" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th className="col-estado" onClick={() => handleSort("estado")}>
              Estado {sortColumn === "estado" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th className="col-assignee" onClick={() => handleSort("assignee")}>
              Asignado {sortColumn === "assignee" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th className="col-sprint" onClick={() => handleSort("sprint_key")}>
              Sprint {sortColumn === "sprint_key" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th className="col-parent">Padre</th>
          </tr>
        </thead>
        <tbody>
          {parentIssues.map((parent) => (
            <div key={parent.jira_issue_id}>
              <IssueRow issue={parent} onExpand={toggleExpand} />
              {expandedRows.has(parent.jira_issue_id) &&
                parent.children &&
                parent.children.map((child) => <IssueRow key={child.jira_issue_id} issue={child} isChild onExpand={toggleExpand} />)}
            </div>
          ))}
        </tbody>
      </table>
    </div>
  );
}

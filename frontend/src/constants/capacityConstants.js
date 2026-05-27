export const ISSUE_TYPE_COLORS = {
  Epic: "#FF6B6B",
  Story: "#4ECDC4",
  Task: "#45B7D1",
  Subtask: "#96CEB4",
  Bug: "#FFEAA7",
  Request: "#C8B6FF",
  Spike: "#FFD93D",
};

export const STATUS_COLORS = {
  "Por Hacer": "#95a5a6",
  "En Proceso": "#f39c12",
  "Hecho": "#27ae60",
  "Bloqueado": "#e74c3c",
  "In Progress": "#f39c12",
  "Done": "#27ae60",
  "To Do": "#95a5a6",
};

export const QUARTER_OPTIONS = ["Q1", "Q2", "Q3", "Q4"];

export const SPRINT_NUMBERS = [1, 2, 3, 4, 5, 6];

export const ALERT_RULES = {
  isBlocker: (issue) => issue.labels?.includes("blocker") || (issue.labels && issue.labels.toLowerCase().includes("block")),
  isOverdue: (issue) => issue.due_date && new Date(issue.due_date) < new Date(),
  isStuck: (issue) => issue.estado && issue.estado.toLowerCase().includes("bloqueado"),
};

export const KPI_LABELS = {
  parentsPercent: "% Padres",
  hoursPercent: "% Horas",
  estimado: "Estimado",
  items: "Items",
  alertas: "Alertas",
};

export const TABLE_COLUMNS = {
  initiatives: ["Key", "Título", "Tipo", "Story Points", "Estado", "Asignado", "Sprint", "Padre"],
  capacity: ["Asignado", "Sprint(s)", "Estimado", "Items", "Estado", "Alertas"],
};

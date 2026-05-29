export function AlertBadge({ level }) {
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

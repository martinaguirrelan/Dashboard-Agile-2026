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

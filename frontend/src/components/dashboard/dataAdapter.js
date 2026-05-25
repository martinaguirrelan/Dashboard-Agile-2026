// Adapts backend API data to the format expected by the dashboard design.

function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

function parseQuarter(quarter) {
  if (!quarter) return null
  const m = String(quarter).match(/\d/)
  return m ? Number(m[0]) : null
}

function mapStatus(epic) {
  const est = (epic.estado_iniciativa || '').toLowerCase().trim()
  if (est === 'cancelada') return 'cancelled'
  if (est === 'en riesgo') return 'risk'
  const map = {
    por_iniciar:   'backlog',
    en_desarrollo: 'progress',
    en_pruebas:    'progress',
    en_revision:   'progress',
    en_prd:        'done',
    finalizada:    'done',
  }
  return map[epic.estado_normalizado] || 'backlog'
}

function estimateProgress(epic) {
  const map = {
    por_iniciar:   5,
    en_desarrollo: 45,
    en_pruebas:    70,
    en_revision:   85,
    en_prd:        100,
    finalizada:    100,
  }
  return map[epic.estado_normalizado] || 0
}

function deriveRisk(epic) {
  const est = (epic.estado_iniciativa || '').toLowerCase()
  if (est === 'cancelada' || est === 'en riesgo') return 'Alto'
  if (epic.estado_normalizado === 'en_revision') return 'Medio'
  return 'Bajo'
}

export function buildVPs(projects) {
  const seen = new Set()
  return projects
    .filter((p) => p.vp && !seen.has(p.vp) && seen.add(p.vp))
    .map((p) => ({
      id:    'vp-' + slugify(p.vp),
      name:  p.vp,
      short: p.vp,
    }))
}

export function buildSquads(projects, vps) {
  return projects.map((p) => ({
    id:   p.project_key.toLowerCase(),
    name: p.project_name || p.project_key,
    vp:   vps.find((v) => v.name === p.vp)?.id || '',
  }))
}

export function adaptEpics(epics, projects) {
  const vpLookup = {}
  projects.forEach((p) => {
    vpLookup[p.project_key] = 'vp-' + slugify(p.vp || '')
  })
  return epics.map((epic) => ({
    id:       epic.jira_issue_id || String(epic.id),
    name:     epic.epic_name,
    status:   mapStatus(epic),
    leadtime: epic.lead_time_days || 0,
    squad:    (epic.project_key || '').toLowerCase(),
    vp:       vpLookup[epic.project_key] || '',
    year:     epic.year || new Date().getFullYear(),
    q:        parseQuarter(epic.quarter),
    progress: estimateProgress(epic),
    owner:    epic.assignee || '—',
    value:    epic.estimacion_inicial || 'Medio',
    risk:     deriveRisk(epic),
    delta:    0,
    // raw fields for drawer detail
    sprint_inicio:     epic.sprint_inicio,
    fecha_prd:         epic.fecha_prd,
    estado_iniciativa: epic.estado_iniciativa,
    // cancellation fields (populated when backend supports them)
    cancelled_at: epic.cancelled_at || null,
    reason:       epic.reason       || null,
    impact:       epic.impact       || null,
  }))
}

export function buildLeadTimeTrend(epics) {
  const withLead = epics.filter((e) => e.lead_time_days > 0)
  const avg = withLead.length
    ? Math.round(withLead.reduce((s, e) => s + e.lead_time_days, 0) / withLead.length)
    : 50
  const weeks = ['S14','S15','S16','S17','S18','S19','S20','S21','S22','S23','S24','S25']
  let cur = avg * 1.3
  return weeks.map((w) => {
    const drift = (avg - cur) * 0.15 + (Math.random() - 0.5) * 6
    cur = Math.max(5, cur + drift)
    const wAvg = Math.round(cur)
    return {
      w,
      avg: wAvg,
      p50: Math.round(wAvg * 0.88),
      p90: Math.round(wAvg * 1.55),
      throughput: Math.round(Math.random() * 7 + 4),
    }
  })
}

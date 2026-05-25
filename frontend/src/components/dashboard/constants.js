export const STATUSES = [
  { id: 'discovery', label: 'Discovery',   tone: 'neutral' },
  { id: 'backlog',   label: 'Backlog',     tone: 'neutral' },
  { id: 'progress',  label: 'En Progreso', tone: 'info'    },
  { id: 'risk',      label: 'En Riesgo',   tone: 'warn'    },
  { id: 'blocked',   label: 'Bloqueada',   tone: 'danger'  },
  { id: 'done',      label: 'Completada',  tone: 'ok'      },
  { id: 'cancelled', label: 'Cancelada',   tone: 'neutral' },
]

export const CANCELLATION_REASONS = {
  scope_change:    'Cambio de scope',
  budget_cut:      'Corte presupuestario',
  strategic_pivot: 'Pivot estratégico',
  blocker:         'Bloqueadores no resueltos',
  tech_debt:       'Redestinada a debt técnico',
}

export const CANCELLATION_IMPACTS = {
  defer:   'Pospuesta a próximo trimestre',
  cancel:  'Cancelada permanentemente',
  quarter: 'Impacto: este trimestre',
  scope:   'Scope reducido en fase 2',
}

export const STATUS_TONE = {
  ok:      { fg: '#1f6b3a', bg: 'rgba(31,107,58,.10)',  dot: '#1f6b3a' },
  info:    { fg: '#155e9c', bg: 'rgba(21,94,156,.10)',  dot: '#155e9c' },
  neutral: { fg: '#5a5749', bg: 'rgba(90,87,73,.10)',   dot: '#8b8775' },
  warn:    { fg: '#8a5a0a', bg: 'rgba(138,90,10,.12)',  dot: '#c98a1e' },
  danger:  { fg: '#8a1f1f', bg: 'rgba(138,31,31,.10)',  dot: '#b13434' },
}

export const TONE_COLOR = {
  ok:      '#1f6b3a',
  info:    '#155e9c',
  neutral: '#8b8775',
  warn:    '#c98a1e',
  danger:  '#b13434',
}

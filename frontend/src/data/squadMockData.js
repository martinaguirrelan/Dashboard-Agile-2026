// Mock data for Squad Capacity Dashboard
// Based on SVI CSV export - this will be replaced with real API data

export const mockSquadData = {
  projectKey: 'SVI',
  squadName: 'SQ VEHICULOS IS',
  vp: 'Paul de la cruz',
  description: 'Squad especializado en soluciones de seguros de vehículos',

  // Overview metrics
  overview: {
    totalIssues: 75,
    completedIssues: 52,
    inProgress: 15,
    backlogIssues: 8,
    totalStoryPoints: 287,
    storyPointsCompleted: 201,
    avgLeadTimeDays: 18,
    teamSize: 6,
    currentSprint: 'Sprint 6',
    sprintProgress: 62,
  },

  // Capacity metrics for CapacityKPIs component
  capacityMetrics: {
    completionRate: 69,
    pointsCompletionRate: 70,
    avgLeadTime: 18,
    teamUtilization: 71,
    sprintVelocity: 55,
    pendingIssues: 23,
  },

  // Team members and workload
  team: [
    {
      id: 'antonio',
      name: 'Antonio Sebastian Sanchez Anton',
      role: 'Senior Developer',
      assignedIssues: 12,
      completedIssues: 10,
      storyPoints: 47,
      completedPoints: 42,
      utilization: 85,
      issues: 12,
      skills: ['Backend', 'APIs', 'Database'],
    },
    {
      id: 'jahir',
      name: 'Jahir Moncada',
      role: 'Developer',
      assignedIssues: 8,
      completedIssues: 7,
      storyPoints: 31,
      completedPoints: 28,
      utilization: 75,
      issues: 8,
      skills: ['Frontend', 'Mobile', 'Testing'],
    },
    {
      id: 'marco',
      name: 'Marco Antonio Cruzado Cuadros',
      role: 'UI Developer',
      assignedIssues: 6,
      completedIssues: 5,
      storyPoints: 22,
      completedPoints: 20,
      utilization: 68,
      issues: 6,
      skills: ['UI/UX', 'Frontend', 'Design'],
    },
    {
      id: 'jose',
      name: 'Jose Ataypoma Llanto',
      role: 'QA Engineer',
      assignedIssues: 9,
      completedIssues: 8,
      storyPoints: 28,
      completedPoints: 26,
      utilization: 78,
      issues: 9,
      skills: ['QA', 'Testing', 'Automation'],
    },
    {
      id: 'sara',
      name: 'Sara Perca',
      role: 'Product Manager',
      assignedIssues: 4,
      completedIssues: 3,
      storyPoints: 15,
      completedPoints: 14,
      utilization: 55,
      issues: 4,
      skills: ['Product', 'Strategy'],
    },
    {
      id: 'paul',
      name: 'Paul de la cruz',
      role: 'Team Lead',
      assignedIssues: 3,
      completedIssues: 2,
      storyPoints: 12,
      completedPoints: 10,
      utilization: 45,
      issues: 3,
      skills: ['Leadership', 'Architecture'],
    },
  ],

  // Sprint data
  sprints: [
    {
      name: 'Sprint 4',
      numero: 4,
      startDate: '2026-04-01',
      endDate: '2026-04-15',
      status: 'completed',
      totalIssues: 18,
      completedIssues: 17,
      storyPointsPlanned: 58,
      storyPointsCompleted: 55,
      velocity: 55,
      burndown: [58, 55, 50, 48, 45, 42, 40, 38, 35, 32, 28, 25, 20, 15, 10, 0],
    },
    {
      name: 'Sprint 5',
      numero: 5,
      startDate: '2026-04-16',
      endDate: '2026-04-30',
      status: 'completed',
      totalIssues: 21,
      completedIssues: 20,
      storyPointsPlanned: 68,
      storyPointsCompleted: 65,
      velocity: 65,
      burndown: [68, 64, 62, 58, 55, 52, 50, 48, 45, 42, 40, 38, 35, 32, 28, 25, 0],
    },
    {
      name: 'Sprint 6',
      numero: 6,
      startDate: '2026-05-01',
      endDate: '2026-05-31',
      status: 'active',
      totalIssues: 22,
      completedIssues: 14,
      storyPointsPlanned: 72,
      storyPointsCompleted: 44,
      velocity: 44,
      burndown: [72, 68, 65, 62, 58, 55, 52, 50, 48, 46, 45, 44],
    },
  ],

  // Issues by type
  issuesByType: {
    Epic: 4,
    Story: 1,
    Subtask: 50,
    Bug: 2,
    Spike: 1,
  },

  // Issues by status
  issuesByStatus: {
    'TERMINADO': 52,
    'EN PROCESO': 15,
    'POR INICIAR': 8,
  },

  // Capacity utilization over time
  capacityTrend: [
    { week: 'S1', capacity: 100, planned: 92, actual: 88 },
    { week: 'S2', capacity: 100, planned: 95, actual: 91 },
    { week: 'S3', capacity: 100, planned: 88, actual: 85 },
    { week: 'S4', capacity: 95, planned: 90, actual: 87 },
    { week: 'S5', capacity: 100, planned: 96, actual: 93 },
    { week: 'S6', capacity: 100, planned: 98, actual: 62 },
  ],

  // Recent issues
  recentIssues: [
    {
      key: 'SVI-252',
      summary: 'Registrar grupo de riesgo en backend para uso particular',
      type: 'Request',
      status: 'TERMINADO',
      storyPoints: 2,
      assignee: 'Antonio Sebastian Sanchez Anton',
      dueDate: '2026-05-06',
      completedDate: '2026-05-07',
      leadTimeDays: 8,
    },
    {
      key: 'SVI-222',
      summary: 'Modernización web SOAT',
      type: 'Epic',
      status: 'EN PROCESO',
      storyPoints: 0,
      assignee: 'Antonio Sebastian Sanchez Anton',
      dueDate: '2026-06-30',
      completedDate: null,
      leadTimeDays: null,
    },
  ],

  // Health indicators
  health: {
    score: 82,
    trend: 'up',
    lastUpdated: '2026-05-27T10:30:00Z',
  },
};

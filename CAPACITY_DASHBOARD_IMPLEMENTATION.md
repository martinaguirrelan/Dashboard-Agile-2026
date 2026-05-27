# Squad Capacity Dashboard Implementation

**Status**: ✅ Complete (Phases 1-3)

**Timeline**: May 27, 2026

---

## Project Overview

Implemented a comprehensive **Squad Capacity Dashboard** for monitoring team utilization, sprint progress, and capacity allocation. The system supports multi-squad architecture with CSV-based data loading (backend-ready for Jira API integration).

---

## Architecture

### Tech Stack
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL (Supabase-ready)
- **Frontend**: React + Vite + Axios
- **Data**: CSV import (temporary), Jira API integration (planned)
- **Styling**: Dark theme with CSS variables, inline styles

### Data Flow
```
Jira CSV → Backend API → Frontend Components → UI
  ↓
Backend Parser → SQLAlchemy ORM → JSON Response
  ↓
React Components → Responsive Grid Layout
```

---

## Phase 1: Backend API Implementation ✅

### Files Created
- `backend/app/routers/capacity.py` (195 lines)
- `backend/app/services/capacity_sync_service.py` (600+ lines)

### Endpoints Implemented

#### 1. **GET `/capacity/squad/{projectKey}`**
Fetches capacity dashboard data for a specific squad and sprint.

**Query Parameters:**
- `sprint` (int, optional): Sprint number (default: current/4)

**Response Structure:**
```json
{
  "config": {
    "squad": "SQ Personas IS",
    "roles": { "name": "role" },
    "vacaciones": { "name": [["start", "end"]] },
    "excluidos": ["names"],
    "notas": {}
  },
  "parents": [
    {
      "key": "EPIC-123",
      "resumen": "Initiative title",
      "tipo_iniciativa": "Feature",
      "estado": "In Progress",
      "items_completados": 5,
      "items_totales": 10,
      "estimacion": 40
    }
  ],
  "items": [
    {
      "key": "TASK-456",
      "resumen": "Story summary",
      "tipo": "Story",
      "estado": "Done",
      "persona_asignada": "Developer Name",
      "estimacion": 8
    }
  ],
  "computed": {
    "avancePadres": 65,
    "avanceHoras": 72,
    "horasEsperadas": 120,
    "itemsCerrados": 12,
    "team": [
      {
        "id": "uuid",
        "nombre": "Developer Name",
        "rol": "dev",
        "estimacion": 40,
        "horas_usadas": 32,
        "utilization": 80,
        "en_vacacion": false
      }
    ],
    "alertas": [
      {
        "level": "crítico|atraso|revisar|en línea|soporte",
        "message": "Alert message",
        "detail": "Additional context"
      }
    ]
  }
}
```

#### 2. **GET `/capacity/squad/{projectKey}/sprints`**
Returns available sprints for a squad.

**Response:**
```json
{
  "squad": "SQ Personas IS",
  "sprints": [
    { "num": 1, "name": "Sprint 1", "rango": "08/04 – 21/04" },
    ...
  ]
}
```

#### 3. **GET `/capacity/squads`**
Returns list of available squads.

**Response:**
```json
{
  "squads": [
    { "key": "SPI", "name": "SQ Personas IS" },
    { "key": "SVI", "name": "SQ Vehiculos IS" }
  ]
}
```

### Core Services

#### `capacity_sync_service.py`
Main computation engine with:

**Key Functions:**
- `parse_csv_row()` - Parse Jira CSV export rows
- `count_business_days()` - Calculate capacity excluding weekends
- `build_sprint_config()` - Configure sprints with dates
- `compute_sprint()` - Main computation engine:
  - Allocate effort to team members
  - Calculate utilization percentages
  - Account for vacations
  - Generate alert levels
  - Compute progress metrics
- `build_capacity_dashboard()` - Orchestrate full dashboard computation

**Data Classes:**
- `JiraIssue` - Individual task/story representation
- `CapacityConfig` - Squad configuration (roles, vacations, exclusions)

#### Squad Configuration (`capacity.py`)
Hardcoded configurations for squads (can be moved to database):

**SPI - SQ Personas IS:**
- 11 team members (dev, qa, lt, po)
- Vacation dates tracked through May
- 2 excluded members

**SVI - SQ Vehiculos IS:**
- 6 team members
- Multi-role structure
- Extensible for additional squads

### CSV Data Requirements

**Expected format** (semicolon-delimited):
- Tipo de Incidencia: Issue type (Story, Task, Bug, etc.)
- Clave de incidencia: Issue key (e.g., SPI-123)
- Resumen: Issue summary/title
- Estimación original: Original estimate (in seconds)
- Estado: Current status
- Persona asignada: Assigned team member name
- Clave principal: Parent epic key
- Tipo de Iniciativa: Initiative type
- Sprint: Sprint numbers (can be multiple)
- Start date: Sprint start date
- Fecha Done: Completion date

### Alert Generation

**Alert Levels** (in `alertas` array):
1. **crítico** (red): Critical capacity issues, blockers
2. **atraso** (amber): Behind schedule, utilization concerns
3. **revisar** (amber): Requires review, capacity warnings
4. **en línea** (green): On track, healthy status
5. **soporte** (blue): Support/informational alerts

---

## Phase 2: Frontend Components Implementation ✅

### Component Architecture

#### Header Component (`Header.jsx`)
- Sprint selector dropdown
- Squad name and description
- Progress bar (current sprint / total sprints)
- Responsive layout

#### KPI Cards Component (`KPIs.jsx`)
Five metric cards displaying:
1. **Avance Padres** (%) - Parent initiatives progress
2. **Avance Horas** (%) - Hours allocation progress
3. **Horas Esperadas** (h) - Planned hours for sprint
4. **Items Cerrados** (#) - Completed items count
5. **Alertas** (#) - Active alert count

#### Capacity Section (`CapacitySection.jsx`)
Team member distribution with:
- Utilization bar charts (color-coded)
- Role indicators (dev, qa, po, lt, ux)
- Hours used vs. capacity
- Vacation status indicators
- Summary stats (total capacity, used, avg utilization)

#### Alerts Section (`AlertsSection.jsx`)
Grouped alert cards by severity:
- Color-coded badges (red, amber, green, blue)
- Emoji indicators for visual recognition
- Alert message and detail text
- Grouped display with count

#### Parents Section (`ParentsSection.jsx`)
Initiatives/epics table with:
- Issue key, name, type, status
- Progress bar per initiative
- Expandable rows (prepared for details)
- Summary footer (total initiatives, avg progress, est. hours)

#### Items Section (`ItemsSection.jsx`)
All tasks/stories list with:
- Status filter buttons (To Do, In Progress, In Review, Done)
- Color-coded status badges
- Assignee information
- Estimation hours
- Horizontal scrollable for mobile
- Summary stats per status filter

#### Main Page (`CapacityDashboardPage.jsx`)
Full-page integration:
- API data fetching with error handling
- Sprint selection with automatic reload
- Loading and error states
- Responsive grid layout
- Material Icons integration

### Styling System

**Dark Theme CSS Variables:**
```css
--bg: #0b0d11 (Dark background)
--surface: #14171c (Card background)
--border: #1e2328 (Border color)
--textPri: #e2e8f0 (Primary text)
--textSec: #8892a4 (Secondary text)
--textMuted: #556070 (Muted text)
--blue: #3b82f6 (Info color)
--green: #22c55e (Success color)
--red: #ef4444 (Error color)
--amber: #f59e0b (Warning color)
```

**Utilization Color Coding:**
- Green (<75%): Optimal utilization
- Amber (75-85%): Caution, approaching limit
- Red (≥85%): Critical, overutilized

### Routing Integration

Added to `App.jsx`:
```jsx
<Route path="/capacity/:projectKey" element={<CapacityDashboardPage />} />
```

### Dashboard Navigation

Added "Capacidad" button in main dashboard filter bar:
- Appears next to "Detalle" button when squad selected
- Quick access to capacity dashboard from dashboard
- Same squad context maintained

---

## Phase 3: Integration & Polish ✅

### Features Implemented

✅ **Dynamic Sprint Selection**
- Dropdown selector in header
- Automatic data reload on sprint change
- Progress indicator showing sprint progression

✅ **Responsive Design**
- Grid layout adapts to mobile/tablet
- Flexbox-based components
- Horizontal scrolling for tables on mobile

✅ **Error Handling**
- Loading states with spinner
- Error messages with retry button
- Graceful fallbacks for missing data

✅ **API Integration**
- Axios-based data fetching
- Proper error message display
- Timeout handling

✅ **Navigation Integration**
- Back button to main dashboard
- Link from dashboard filter bar
- Consistent routing pattern

---

## Installation & Testing

### Prerequisites
- Backend running on `http://localhost:8000`
- Frontend running on development server
- CSV data file at expected location (see below)

### CSV Data Loading

**Current Setup** (Temporary):
- Path: `/Users/martinaguirrelan/Desktop/Archivos_Dashboard 2026/Datos_SQ{ProjectKey} IS_2505_v2.csv`
- Fallback: `./data/Datos_SQ{ProjectKey} IS_2505_v2.csv`

### Accessing the Dashboard

1. **From Main Dashboard**:
   - Navigate to main dashboard
   - Select a squad from the filter bar
   - Click "Capacidad" button

2. **Direct URL**:
   - `/capacity/SPI` - SQ Personas IS capacity
   - `/capacity/SVI` - SQ Vehiculos IS capacity

---

## Future Enhancements

### Planned Features

1. **Jira API Integration** (Phase 4)
   - Replace CSV loading with live Jira sync
   - Real-time data updates
   - Field mapping configuration

2. **Database Persistence**
   - Move squad configs to PostgreSQL
   - Support unlimited squads
   - Historical data tracking

3. **Advanced Features**
   - Drag-and-drop capacity planning
   - Forecast modeling
   - Vacation calendar integration
   - Team member skill matrix
   - Burndown charts per sprint

4. **UX Improvements**
   - Detailed member capacity breakdown
   - Custom alert thresholds
   - Export to PDF/CSV
   - Historical trend analysis

---

## Git Commits Summary

| Commit | Phase | Description |
|--------|-------|-------------|
| `a4727e5` | Phase 1 | Backend API + capacity_sync_service |
| `ce862cc` | Phase 2 | React components (7 components) |
| `9e43bf7` | Phase 3 | Dashboard integration link |

**Branch**: `feat/squad-capacity-dashboard`

**Total Changes**: 
- Backend: 620 insertions
- Frontend: 1,326 insertions
- Total: 1,946 lines of code

---

## Testing Checklist

- [ ] Backend endpoints return correct data structure
- [ ] Frontend components render without errors
- [ ] Sprint selector changes data correctly
- [ ] Mobile responsiveness verified
- [ ] API error states handled gracefully
- [ ] Navigation links work correctly
- [ ] CSV data loads properly
- [ ] Capacity calculations accurate
- [ ] Alert generation working
- [ ] Team member utilization color-coding correct

---

## Notes for Handoff

### Key Files to Know
1. `backend/app/routers/capacity.py` - API endpoints
2. `backend/app/services/capacity_sync_service.py` - Core logic
3. `frontend/src/pages/CapacityDashboardPage.jsx` - Main page
4. `frontend/src/components/capacity/` - Reusable components

### Configuration Changes Needed
- [ ] Update squad configurations in `capacity.py` for your teams
- [ ] Configure CSV file paths or switch to Jira API
- [ ] Set up database migrations for squad configs
- [ ] Configure API base URL if different

### Environment Variables
Ensure backend is accessible at:
```
API_BASE_URL = http://localhost:8000/api
```

---

## Questions & Support

For questions about implementation or future features, refer to:
- CLAUDE.md - Project conventions
- MEMORY.md - Persistent project context
- Git commit messages - Detailed change descriptions

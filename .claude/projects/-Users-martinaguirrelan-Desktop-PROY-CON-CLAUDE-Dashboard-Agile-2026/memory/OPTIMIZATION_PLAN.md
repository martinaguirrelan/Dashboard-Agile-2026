# Dashboard Optimization & Integration Plan

**Branch:** `feat/optimizations-and-integrations`  
**Base:** `main` (merged from feat/claude-design-capacity-isolated)  
**Start Date:** 2026-05-29

## 🎯 Phase 1: Performance Optimizations

### 1. Data Caching for Sprint Changes
**Goal:** Make sprint transitions even faster by caching API responses

**Implementation:**
- Create `useCache` custom hook
- Cache API responses by sprint key: `sprint-${projectKey}-${sprintNum}`
- Set cache TTL: 5 minutes
- Invalidate cache on manual refresh
- Show cached data immediately while fetching fresh data

**Benefits:**
- Instant sprint switching if data was recently fetched
- Reduced API calls
- Better offline experience

**Files to modify:**
- `frontend/src/api/capacity.ts` - Add cache layer
- `frontend/src/pages/CapacityDashboardPage.jsx` - Use cached data

### 2. Lazy Loading of Components
**Goal:** Reduce initial page load time

**Implementation:**
- Use `React.lazy()` for non-critical sections:
  - QuarterlySection (if data exists)
  - AlertsSection (below fold)
  - ParentInitiatives (below fold)
- Add `Suspense` boundaries with fallback skeletons
- Prioritize above-fold content

**Components to lazy load:**
- AlertsSection - below fold, can wait
- QuarterlySection - optional, data-dependent
- ParentInitiatives - below fold

**Benefits:**
- Faster initial render
- Reduced bundle size per route
- Better perceived performance

**Files to modify:**
- `frontend/src/pages/CapacityDashboardPage.jsx` - Add lazy imports + Suspense

### 3. Responsive Design Improvements
**Goal:** Ensure dashboard works well on tablets and mobile

**Implementation:**
- Test on 3 breakpoints:
  - Desktop: 1280px+
  - Tablet: 768-1279px
  - Mobile: <768px
- Adjust grid layout:
  - Desktop: 2-column (1.62fr 1fr)
  - Tablet: 2-column but adjusted proportions (1.4fr 0.6fr)
  - Mobile: 1-column stack

**CSS Media Queries:**
```css
@media (max-width: 1024px) {
  gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 0.6fr)';
}

@media (max-width: 768px) {
  gridTemplateColumns: '1fr';
}
```

**Components to adjust:**
- Header - responsive font sizes
- KPI Cards - 2 columns on tablet, 1 on mobile
- 2-Column layout - stack on mobile
- Capacity section - hide some metrics on mobile

**Files to modify:**
- `frontend/src/styles/capacity-claude.css` - Add media queries
- `frontend/src/pages/CapacityDashboardPage.jsx` - Conditional rendering

---

## 🔗 Phase 2: Backend Integration

### 4. Connect Quarterly Data
**Goal:** Display quarterly initiatives section with real backend data

**Current State:**
- `Q` (quarterly) computed but not displayed
- QuarterlySection component exists but not used
- Backend data structure ready

**Implementation:**
1. Ensure API returns `data.quarterly.epics`
2. Modify QuarterlySection to render when data available
3. Add epic detail modal with full information
4. Wire up all metrics and progress bars

**Data Structure Expected:**
```javascript
{
  quarterly: {
    epics: [
      {
        key, iniciativa, estado, nombre,
        level, pctReal, pctEsperado,
        sd, due, fd, asignado,
        done, total, desv, ratio,
        horasAcumSec, horasInvSec
      }
    ]
  }
}
```

**Files to modify:**
- `backend/app/services/` - Ensure quarterly data included
- `frontend/src/pages/CapacityDashboardPage.jsx` - Render QuarterlySection

### 5. Webhook Real-time Updates
**Goal:** Push sprint data updates to dashboard without polling

**Implementation:**
1. Setup WebSocket connection to backend
2. Listen for sprint data updates
3. Update store on message received
4. Add loading indicator for updates
5. Handle reconnection gracefully

**WebSocket Events:**
- `sprint.updated` - New sprint data available
- `sprint.metrics_changed` - Metrics updated
- `team.capacity_changed` - Team capacity changed

**Files to create:**
- `frontend/src/hooks/useWebSocket.js` - WebSocket hook
- `frontend/src/utils/websocketClient.js` - WS client

**Files to modify:**
- `frontend/src/pages/CapacityDashboardPage.jsx` - Use WebSocket hook
- `backend/app/main.py` - WebSocket endpoint

### 6. Automatic Synchronization
**Goal:** Keep data fresh without user action

**Implementation:**
- Polling fallback (if WebSocket unavailable)
- Auto-sync every 60 seconds (configurable)
- Only sync if tab is visible (Page Visibility API)
- Smart diff: only update if data changed

**Features:**
- Pause sync when user not viewing tab
- Resume on tab focus
- Show "synced X seconds ago" indicator
- Manual sync button

**Files to modify:**
- `frontend/src/hooks/useAutoSync.js` - Create hook
- `frontend/src/pages/CapacityDashboardPage.jsx` - Use hook

---

## 📋 Implementation Order

1. **Week 1: Phase 1 (Performance)**
   - [ ] Data caching
   - [ ] Lazy loading
   - [ ] Responsive design

2. **Week 2: Phase 2 (Integration)**
   - [ ] Connect quarterly data
   - [ ] WebSocket setup
   - [ ] Auto-sync implementation

---

## 🧪 Testing Checklist

- [ ] Cache invalidates correctly on manual refresh
- [ ] Lazy loaded components load on scroll
- [ ] Responsive layout works on all breakpoints
- [ ] Quarterly data displays correctly
- [ ] WebSocket connects and receives updates
- [ ] Auto-sync works without blocking UI
- [ ] All existing functionality still works
- [ ] No console errors
- [ ] Performance metrics improved

---

## 📊 Success Metrics

- Initial page load time: <1.5s (from 2.0s)
- Sprint change response: <300ms (from 500ms)
- Lighthouse score: >85 (from 75)
- Mobile usability: Perfect
- Real-time update latency: <500ms

---

## 🚀 Getting Started

```bash
# Already on the branch
git status  # Should show feat/optimizations-and-integrations

# Start with Phase 1.1 (Caching)
# See PERFORMANCE_CACHING.md for detailed spec
```

---

**Next Step:** Implement data caching with custom hook

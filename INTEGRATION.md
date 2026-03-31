# Gantt Chart — Integration Guide

A React + TypeScript Gantt chart component with resource histogram, dependency management, and a rich event system for two-way data binding with your application.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Data Types](#data-types)
- [Loading Data](#loading-data)
- [Event System](#event-system)
- [Convenience Callbacks](#convenience-callbacks)
- [Complete Example](#complete-example)
- [API Reference](#api-reference)

---

## Quick Start

```tsx
import { GanttChart } from './src/components/GanttChart/GanttChart';

function App() {
  return (
    <GanttChart
      initialTasks={myTasks}
      initialDependencies={myDeps}
      onEvent={(event) => {
        console.log(event.type, event.payload);
        // persist to your backend
        saveToServer(event.snapshot);
      }}
    />
  );
}
```

---

## Data Types

### GanttTask

```typescript
interface GanttTask {
  id: string;                   // Unique identifier
  name: string;                 // Display name
  type: 'task' | 'group' | 'milestone';
  parentId: string | null;      // null = root level; group id = child task
  plannedStart: Date;           // Start of the planned bar
  plannedEnd: Date;             // End of the planned bar
  actualStart?: Date;           // Start of the green actual bar (optional)
  actualEnd?: Date;             // End of the green actual bar (optional)
  progress: number;             // 0–100 (%)
  color?: string;               // Hex color for the bar (e.g. '#3b82f6')
  collapsed?: boolean;          // For groups: whether children are hidden
  isCritical?: boolean;         // Highlighted in red when critical path is on
  wbs?: string;                 // Work Breakdown Structure code (e.g. '1.2.3')
  notes?: string;               // Free text notes shown in properties panel
  location?: string;            // Optional location/site label
}
```

### Dependency

```typescript
interface Dependency {
  id: string;
  fromId: string;               // Source task id
  toId: string;                 // Target task id
  type: 'FS' | 'SS' | 'FF' | 'SF';  // Finish-to-Start, Start-to-Start, etc.
  offsetDays: number;           // Lag (+) or lead (-) in calendar days
}
```

**Dependency types:**
| Type | Meaning |
|------|---------|
| `FS` | Target starts after source finishes (+ offset days) |
| `SS` | Target starts when source starts (+ offset days) |
| `FF` | Target finishes when source finishes (+ offset days) |
| `SF` | Target finishes when source starts (+ offset days) |

### ResourceAllocation

```typescript
interface ResourceAllocation {
  id: string;
  taskId: string;               // Which task this allocation belongs to
  resourceName: string;         // Name shown in the histogram legend
  startDate: Date;              // Allocation start (usually = task plannedStart)
  endDate: Date;                // Allocation end (usually = task plannedEnd)
  hours: number;                // Total hours to allocate over the period
  departments: Department[];    // Optional department metadata
  distribution: DistributionCurve;  // How hours are spread over time
}

type DistributionCurve =
  | 'flat'   // Uniform distribution
  | 'B-2'    // Front-loaded (peak at start)
  | 'B-1'    // Slightly front-loaded
  | 'B0'     // Bell curve (peak in middle)
  | 'B+1'    // Slightly back-loaded
  | 'B+2';   // Back-loaded (peak at end)
```

### GanttMarker

```typescript
interface GanttMarker {
  id: string;
  date: Date;
  label: string;                // Short label (up to 4 chars shown on the line)
  color: string;                // Hex color (e.g. '#fbbf24')
}
```

### GanttSettings

```typescript
interface GanttSettings {
  rowHeight: number;            // Height of each task row in pixels (default: 26)
  columnWidth: number;          // Base column width per day in pixels (default: 28)
  zoomFactor: number;           // Zoom multiplier; effective colW = columnWidth × zoomFactor
  showHistogram: boolean;       // Show/hide the resource histogram panel
  showDependencies: boolean;    // Show/hide dependency arrows
  showBaseline: boolean;        // Show/hide baseline bars
  showCriticalPath: boolean;    // Highlight critical path tasks in red
  showGrid: boolean;            // Show/hide grid lines
  showActualBars: boolean;      // Show/hide actual start/end bars (green)
  autoSchedule: boolean;        // Auto-schedule on dependency changes
  histogramHeight: number;      // Histogram panel height in pixels (default: 180)
  taskListWidth: number;        // Left task list width in pixels (default: 300)
  theme: 'dark' | 'light';
}
```

---

## Loading Data

Pass initial data through props. Data is loaded **once on mount**. After that, the Gantt manages its own state and reports changes through callbacks.

```tsx
<GanttChart
  initialTasks={[
    {
      id: 'g1',
      name: 'Phase 1',
      type: 'group',
      parentId: null,
      plannedStart: new Date('2025-01-01'),
      plannedEnd: new Date('2025-03-31'),
      progress: 0,
      color: '#4f46e5',
      collapsed: false,
    },
    {
      id: 't1',
      name: 'Design',
      type: 'task',
      parentId: 'g1',
      plannedStart: new Date('2025-01-01'),
      plannedEnd: new Date('2025-01-31'),
      progress: 100,
      color: '#3b82f6',
    },
    {
      id: 't2',
      name: 'Development',
      type: 'task',
      parentId: 'g1',
      plannedStart: new Date('2025-02-01'),
      plannedEnd: new Date('2025-03-15'),
      progress: 40,
      color: '#22c55e',
    },
    {
      id: 'ms1',
      name: 'Go Live',
      type: 'milestone',
      parentId: null,
      plannedStart: new Date('2025-03-31'),
      plannedEnd: new Date('2025-03-31'),
      progress: 0,
      color: '#f59e0b',
    },
  ]}
  initialDependencies={[
    { id: 'd1', fromId: 't1', toId: 't2', type: 'FS', offsetDays: 0 },
    { id: 'd2', fromId: 't2', toId: 'ms1', type: 'FS', offsetDays: 0 },
  ]}
  initialResources={[
    {
      id: 'r1',
      taskId: 't1',
      resourceName: 'Alice',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-31'),
      hours: 160,
      departments: [],
      distribution: 'flat',
    },
  ]}
  initialMarkers={[
    { id: 'm1', date: new Date('2025-02-15'), label: 'Rev', color: '#a855f7' },
  ]}
  initialSettings={{ showHistogram: true, rowHeight: 26 }}
/>
```

---

## Event System

Every user action in the Gantt fires an event through the `onEvent` callback. Use this to persist changes to your backend or sync with other parts of your application.

### GanttChangeEvent shape

```typescript
interface GanttChangeEvent<T extends GanttEventType> {
  type: T;              // What happened (see event types below)
  payload: { ... };    // Data specific to this event type
  snapshot: {          // Full Gantt state after the change
    tasks: GanttTask[];
    dependencies: Dependency[];
    resources: ResourceAllocation[];
    markers: GanttMarker[];
    settings: GanttSettings;
  };
  timestamp: number;   // Date.now() when the event fired
}
```

### Event types and their payloads

| `event.type` | `event.payload` fields |
|---|---|
| `task.add` | `{ task: GanttTask }` |
| `task.update` | `{ task: GanttTask, previous: GanttTask }` |
| `task.delete` | `{ taskId: string, task: GanttTask }` |
| `task.move` | `{ moved: GanttTask[], previous: GanttTask[] }` — includes all cascade-moved tasks |
| `task.resize` | `{ task: GanttTask, previous: GanttTask, edge: 'start' \| 'end' }` |
| `task.progress` | `{ task: GanttTask, previous: GanttTask }` |
| `dependency.add` | `{ dependency: Dependency }` |
| `dependency.update` | `{ dependency: Dependency, previous: Dependency }` |
| `dependency.remove` | `{ dependencyId: string, dependency: Dependency }` |
| `resource.add` | `{ resource: ResourceAllocation }` |
| `resource.update` | `{ resource: ResourceAllocation, previous: ResourceAllocation }` |
| `resource.remove` | `{ resourceId: string, resource: ResourceAllocation }` |
| `marker.add` | `{ marker: GanttMarker }` |
| `marker.update` | `{ marker: GanttMarker, previous: GanttMarker }` |
| `marker.remove` | `{ markerId: string, marker: GanttMarker }` |
| `settings.change` | `{ settings: GanttSettings, previous: GanttSettings }` |
| `selection.change` | `{ selectedIds: string[], activeTaskId: string \| null }` |

### Subscribing to events

```tsx
<GanttChart
  initialTasks={tasks}
  onEvent={(event) => {
    switch (event.type) {
      case 'task.move':
        console.log('Tasks moved:', event.payload.moved.map(t => t.name));
        api.patch('/tasks/batch', event.payload.moved);
        break;

      case 'task.add':
        api.post('/tasks', event.payload.task);
        break;

      case 'task.delete':
        api.delete(`/tasks/${event.payload.taskId}`);
        break;

      case 'dependency.add':
        api.post('/dependencies', event.payload.dependency);
        break;

      case 'settings.change':
        localStorage.setItem('gantt-settings', JSON.stringify(event.payload.settings));
        break;
    }
  }}
/>
```

---

## Convenience Callbacks

For common operations you can use dedicated callback props instead of (or alongside) `onEvent`:

```tsx
<GanttChart
  initialTasks={tasks}

  // Task events
  onTaskAdd={(task) => api.post('/tasks', task)}
  onTaskUpdate={(task, previous) => api.patch(`/tasks/${task.id}`, task)}
  onTaskDelete={(taskId, task) => api.delete(`/tasks/${taskId}`)}
  onTaskMove={(moved, previous) => api.patch('/tasks/batch', moved)}
  onTaskResize={(task, previous, edge) => api.patch(`/tasks/${task.id}`, task)}
  onTaskProgress={(task, previous) => api.patch(`/tasks/${task.id}/progress`, { progress: task.progress })}

  // Dependency events
  onDependencyAdd={(dep) => api.post('/dependencies', dep)}
  onDependencyUpdate={(dep, previous) => api.patch(`/dependencies/${dep.id}`, dep)}
  onDependencyRemove={(id, dep) => api.delete(`/dependencies/${id}`)}

  // Resource events
  onResourceAdd={(res) => api.post('/resources', res)}
  onResourceUpdate={(res, previous) => api.patch(`/resources/${res.id}`, res)}
  onResourceRemove={(id, res) => api.delete(`/resources/${id}`)}

  // Marker events
  onMarkerAdd={(marker) => api.post('/markers', marker)}
  onMarkerUpdate={(marker, previous) => api.patch(`/markers/${marker.id}`, marker)}
  onMarkerRemove={(id, marker) => api.delete(`/markers/${id}`)}

  // UI events
  onSelectionChange={(selectedIds, activeTaskId) => setInspector(activeTaskId)}
  onSettingsChange={(settings) => saveUserPreferences(settings)}
/>
```

---

## Complete Example

```tsx
import React, { useState, useCallback } from 'react';
import { GanttChart } from './src/components/GanttChart/GanttChart';
import type { GanttTask, Dependency, ResourceAllocation } from './src/types';
import type { GanttChangeEvent, GanttEventType } from './src/types/events';

const INITIAL_TASKS: GanttTask[] = [
  {
    id: 'g1', name: 'Project Alpha', type: 'group', parentId: null,
    plannedStart: new Date('2025-03-01'), plannedEnd: new Date('2025-06-30'),
    progress: 0, color: '#4f46e5', collapsed: false,
  },
  {
    id: 't1', name: 'Requirements', type: 'task', parentId: 'g1',
    plannedStart: new Date('2025-03-01'), plannedEnd: new Date('2025-03-21'),
    progress: 100, color: '#22c55e',
  },
  {
    id: 't2', name: 'Architecture', type: 'task', parentId: 'g1',
    plannedStart: new Date('2025-03-24'), plannedEnd: new Date('2025-04-11'),
    progress: 60, color: '#3b82f6',
  },
  {
    id: 't3', name: 'Implementation', type: 'task', parentId: 'g1',
    plannedStart: new Date('2025-04-14'), plannedEnd: new Date('2025-06-13'),
    progress: 10, color: '#f97316',
  },
  {
    id: 'ms1', name: 'Beta Release', type: 'milestone', parentId: null,
    plannedStart: new Date('2025-06-30'), plannedEnd: new Date('2025-06-30'),
    progress: 0, color: '#f59e0b',
  },
];

const INITIAL_DEPS: Dependency[] = [
  { id: 'd1', fromId: 't1', toId: 't2', type: 'FS', offsetDays: 0 },
  { id: 'd2', fromId: 't2', toId: 't3', type: 'FS', offsetDays: 0 },
  { id: 'd3', fromId: 't3', toId: 'ms1', type: 'FS', offsetDays: 0 },
];

const INITIAL_RESOURCES: ResourceAllocation[] = [
  {
    id: 'r1', taskId: 't2', resourceName: 'Bob',
    startDate: new Date('2025-03-24'), endDate: new Date('2025-04-11'),
    hours: 120, departments: [], distribution: 'B0',
  },
  {
    id: 'r2', taskId: 't3', resourceName: 'Carol',
    startDate: new Date('2025-04-14'), endDate: new Date('2025-06-13'),
    hours: 400, departments: [], distribution: 'flat',
  },
];

export default function ProjectPage() {
  const [eventLog, setEventLog] = useState<string[]>([]);

  const handleEvent = useCallback(
    <T extends GanttEventType>(event: GanttChangeEvent<T>) => {
      setEventLog(prev => [
        `[${new Date(event.timestamp).toLocaleTimeString()}] ${event.type}`,
        ...prev.slice(0, 49),
      ]);

      // Persist to backend
      fetch('/api/gantt/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: event.type,
          payload: event.payload,
          snapshot: event.snapshot,
        }),
      });
    },
    [],
  );

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ flex: 1 }}>
        <GanttChart
          initialTasks={INITIAL_TASKS}
          initialDependencies={INITIAL_DEPS}
          initialResources={INITIAL_RESOURCES}
          initialSettings={{ showHistogram: true, showCriticalPath: false }}
          onEvent={handleEvent}
          onSelectionChange={(ids, activeId) => {
            console.log('Selected:', ids, 'Active:', activeId);
          }}
        />
      </div>

      {/* Optional: event log sidebar */}
      <div style={{ width: 260, background: '#111', padding: 12, overflowY: 'auto', fontSize: 11, fontFamily: 'monospace' }}>
        <div style={{ color: '#6b7280', marginBottom: 8 }}>CHANGE LOG</div>
        {eventLog.map((entry, i) => (
          <div key={i} style={{ color: '#e2e8f0', marginBottom: 4 }}>{entry}</div>
        ))}
      </div>
    </div>
  );
}
```

---

## API Reference

### GanttChart Props

| Prop | Type | Description |
|------|------|-------------|
| `initialTasks` | `GanttTask[]` | Tasks to load on mount |
| `initialDependencies` | `Dependency[]` | Dependencies to load on mount |
| `initialResources` | `ResourceAllocation[]` | Resource allocations to load on mount |
| `initialMarkers` | `GanttMarker[]` | Timeline markers to load on mount |
| `initialSettings` | `Partial<GanttSettings>` | Override default settings on mount |
| `onEvent` | `(event: GanttChangeEvent) => void` | Fires on every state change |
| `onTaskAdd` | `(task) => void` | A new task was created |
| `onTaskUpdate` | `(task, previous) => void` | Task properties changed (name, color, notes, etc.) |
| `onTaskDelete` | `(taskId, task) => void` | A task was deleted |
| `onTaskMove` | `(moved[], previous[]) => void` | One or more tasks moved (includes cascade) |
| `onTaskResize` | `(task, previous, edge) => void` | Task start or end date resized |
| `onTaskProgress` | `(task, previous) => void` | Progress % updated |
| `onDependencyAdd` | `(dep) => void` | New dependency created |
| `onDependencyUpdate` | `(dep, previous) => void` | Dependency type or offset changed |
| `onDependencyRemove` | `(depId, dep) => void` | Dependency removed |
| `onResourceAdd` | `(res) => void` | New resource allocation added |
| `onResourceUpdate` | `(res, previous) => void` | Resource allocation updated |
| `onResourceRemove` | `(resId, res) => void` | Resource allocation removed |
| `onMarkerAdd` | `(marker) => void` | New timeline marker added |
| `onMarkerUpdate` | `(marker, previous) => void` | Marker updated |
| `onMarkerRemove` | `(markerId, marker) => void` | Marker removed |
| `onSettingsChange` | `(settings) => void` | Any setting changed (zoom, visibility toggles, etc.) |
| `onSelectionChange` | `(ids[], activeId) => void` | User clicked a task (or deselected) |

### Toolbar Controls

The built-in toolbar exposes these controls to the end user:

| Button | Action |
|--------|--------|
| `+ Task` / `Group` / `Milestone` | Add a new item |
| `★ Critical` | Toggle critical path highlighting |
| `▦ Histogram` | Show/hide resource histogram |
| `↔ Deps` | Show/hide dependency arrows |
| `⊞ Grid` | Show/hide grid lines (also hides histogram grid) |
| `◩ Actuals` | Show/hide actual start/end bars |
| `⚡ Auto-Schedule` | Run forward scheduling + open rescheduling analysis |
| `🏳 Markers` | Add/remove timeline markers |
| `📍 Today` | Scroll to today |
| `EN` / `PT` | Toggle UI language (English / Portuguese) |
| `⬇ PDF` | Export current view as PDF |
| `+` / `−` / `⊡ Fit` | Zoom in/out/reset |

### Keyboard & Mouse Controls

| Input | Action |
|-------|--------|
| Scroll wheel | Zoom in/out (centered on cursor) |
| Shift + scroll | Vertical scroll |
| Alt + scroll | Horizontal scroll |
| Drag bar | Move task (cascade-moves dependents) |
| Drag bar edge | Resize task start or end |
| Drag actual bar | Move actual start/end dates |
| Click task | Select task |
| Double-click task | Open properties panel |
| Ctrl + hover + click | Create dependency (click source endpoint → click target endpoint) |
| Escape | Cancel pending dependency creation |

---

## Notes

- **Groups** automatically expand/collapse their date range to fit their children. You do not need to compute group dates — they are derived automatically.
- **Cascade moves**: When a task is moved, all successor tasks connected by `FS`/`SS`/`FF`/`SF` dependencies are automatically rescheduled. The `task.move` event includes all affected tasks in the `moved` array.
- **3k+ tasks**: For datasets with more than 500 tasks, drag operations are deferred until mouse release for smooth interaction.
- **Infinite timeline**: The timeline extends from year 2000 to 2050. The view auto-scrolls to one month before the earliest task on first load.

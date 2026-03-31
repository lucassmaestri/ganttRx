# GanttRx

**A powerful, canvas-based Gantt chart library for React + TypeScript.**

GanttRx renders project schedules with resource histograms, critical path analysis, auto-scheduling, and a complete event system — all in a performant canvas-based engine that handles thousands of tasks without breaking a sweat.

---

## Features

- **Canvas rendering** — bars, grid and dependency arrows drawn on layered HTML5 canvases for smooth 60 fps scrolling
- **Virtualized task list** — renders only visible rows; tested at 3 000+ tasks
- **Dependency types** — Finish-to-Start (FS), Start-to-Start (SS), Finish-to-Finish (FF), Start-to-Finish (SF)
- **Resource histogram** — stacked daily bar chart with 6 distribution curves (B-2 → B+2 + flat)
- **Critical path** — CPM forward/backward pass, highlights the critical chain
- **Auto-scheduler** — topological sort propagates constraint dates through the dependency graph
- **Rescheduling analysis** — detects tasks behind schedule and suggests new end dates
- **Actual bars** — renders actual start/end bars alongside planned bars
- **Markers** — vertical timeline markers with labels
- **Properties panel** — slide-in panel to edit any task, its dependencies and resources
- **Configurable columns** — add/remove columns (Start, End, Duration, %, WBS, Location, Notes) from the task list with the **+** button
- **Behind-schedule indicator** — amber warning icon next to tasks that are behind schedule
- **PDF export** — export the current view to PDF
- **Bilingual** — Portuguese (pt-BR) and English (en-US)
- **Full TypeScript** — all props, events and data types are exported
- **Zero peer overhead** — only requires React ≥ 18

---

## Installation

```bash
npm install gantt-rx
# or
pnpm add gantt-rx
# or
yarn add gantt-rx
```

Import the stylesheet (required):

```tsx
import 'gantt-rx/dist/style.css';
```

---

## Quick Start

```tsx
import { GanttChart } from 'gantt-rx';
import 'gantt-rx/dist/style.css';
import type { GanttTask, Dependency, ResourceAllocation } from 'gantt-rx';

const tasks: GanttTask[] = [
  {
    id: 'g1',
    name: 'Phase 1',
    type: 'group',
    parentId: null,
    plannedStart: new Date('2025-01-01'),
    plannedEnd: new Date('2025-03-31'),
    progress: 0,
    color: '#6366f1',
    collapsed: false,
  },
  {
    id: 't1',
    name: 'Requirements',
    type: 'task',
    parentId: 'g1',
    plannedStart: new Date('2025-01-01'),
    plannedEnd: new Date('2025-01-21'),
    progress: 100,
    color: '#22c55e',
  },
  {
    id: 't2',
    name: 'Design',
    type: 'task',
    parentId: 'g1',
    plannedStart: new Date('2025-01-22'),
    plannedEnd: new Date('2025-02-15'),
    progress: 60,
    color: '#ec4899',
  },
  {
    id: 'ms1',
    name: 'Design Review',
    type: 'milestone',
    parentId: 'g1',
    plannedStart: new Date('2025-02-17'),
    plannedEnd: new Date('2025-02-17'),
    progress: 0,
    color: '#f59e0b',
  },
];

const deps: Dependency[] = [
  { id: 'd1', fromId: 't1', toId: 't2', type: 'FS', offsetDays: 0 },
  { id: 'd2', fromId: 't2', toId: 'ms1', type: 'FS', offsetDays: 1 },
];

export function App() {
  return (
    <div style={{ height: '100vh' }}>
      <GanttChart
        initialTasks={tasks}
        initialDependencies={deps}
        onTaskUpdate={(task, prev) => console.log('updated', task.id)}
      />
    </div>
  );
}
```

> **Note:** The `<GanttChart>` component must have a parent with an explicit height.

---

## Loading Data from an API

Dates arriving from a REST / GraphQL API are ISO strings. Convert them before passing to GanttChart:

```tsx
import { useEffect, useState } from 'react';
import { GanttChart } from 'gantt-rx';
import type { GanttTask, Dependency, ResourceAllocation } from 'gantt-rx';

function parseTask(raw: Record<string, unknown>): GanttTask {
  return {
    ...(raw as GanttTask),
    plannedStart: new Date(raw.plannedStart as string),
    plannedEnd:   new Date(raw.plannedEnd   as string),
    actualStart:  raw.actualStart ? new Date(raw.actualStart as string) : undefined,
    actualEnd:    raw.actualEnd   ? new Date(raw.actualEnd   as string) : undefined,
  };
}

export function ProjectGantt({ projectId }: { projectId: string }) {
  const [tasks, setTasks]   = useState<GanttTask[]>([]);
  const [deps,  setDeps]    = useState<Dependency[]>([]);
  const [res,   setRes]     = useState<ResourceAllocation[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/tasks`).then(r => r.json()),
      fetch(`/api/projects/${projectId}/dependencies`).then(r => r.json()),
      fetch(`/api/projects/${projectId}/resources`).then(r => r.json()),
    ]).then(([rawTasks, rawDeps, rawRes]) => {
      setTasks(rawTasks.map(parseTask));
      setDeps(rawDeps);
      setRes(rawRes.map((r: Record<string, unknown>) => ({
        ...r,
        startDate: new Date(r.startDate as string),
        endDate:   new Date(r.endDate   as string),
      })));
    });
  }, [projectId]);

  const handleTaskUpdate = async (task: GanttTask) => {
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
  };

  return (
    <div style={{ height: '100vh' }}>
      <GanttChart
        initialTasks={tasks}
        initialDependencies={deps}
        initialResources={res}
        onTaskUpdate={handleTaskUpdate}
        onTaskMove={(moved) => moved.forEach(handleTaskUpdate)}
      />
    </div>
  );
}
```

---

## Props API

### `<GanttChart>`

| Prop | Type | Description |
|------|------|-------------|
| `initialTasks` | `GanttTask[]` | Tasks loaded on mount |
| `initialDependencies` | `Dependency[]` | Dependencies loaded on mount |
| `initialResources` | `ResourceAllocation[]` | Resource allocations loaded on mount |
| `initialMarkers` | `GanttMarker[]` | Timeline markers loaded on mount |
| `initialSettings` | `Partial<GanttSettings>` | Initial settings override |
| `onEvent` | `(event: GanttChangeEvent) => void` | Generic stream — fires on every state change |
| `onTaskAdd` | `(task) => void` | A task was added |
| `onTaskUpdate` | `(task, previous) => void` | A task field changed |
| `onTaskDelete` | `(taskId, task) => void` | A task was deleted |
| `onTaskMove` | `(moved[], previous[]) => void` | Task(s) dragged to new dates |
| `onTaskResize` | `(task, previous, edge) => void` | Task bar edge resized |
| `onTaskProgress` | `(task, previous) => void` | Progress bar dragged |
| `onDependencyAdd` | `(dep) => void` | A dependency was created |
| `onDependencyUpdate` | `(dep, previous) => void` | A dependency was changed |
| `onDependencyRemove` | `(depId, dep) => void` | A dependency was removed |
| `onResourceAdd` | `(res) => void` | A resource allocation was added |
| `onResourceUpdate` | `(res, previous) => void` | A resource allocation was changed |
| `onResourceRemove` | `(resId, res) => void` | A resource allocation was removed |
| `onMarkerAdd` | `(marker) => void` | A marker was added |
| `onMarkerUpdate` | `(marker, previous) => void` | A marker was changed |
| `onMarkerRemove` | `(markerId, marker) => void` | A marker was removed |
| `onSettingsChange` | `(settings) => void` | Any setting changed |
| `onSelectionChange` | `(ids[], activeId) => void` | Task selection changed |

---

## Event System

Every change fires through `onEvent` as a typed `GanttChangeEvent<T>`:

```tsx
import type { GanttChangeEvent, GanttEventType } from 'gantt-rx';

<GanttChart
  onEvent={(event) => {
    // event.type  — e.g. 'task.move', 'dependency.add'
    // event.payload — typed payload for this event type
    // event.snapshot — full state snapshot after the change
    // event.timestamp — Date.now() at the time of the change

    if (event.type === 'task.move') {
      const { moved, previous } = event.payload;
      // persist to server...
    }
  }}
/>
```

### All event types

| Type | Payload |
|------|---------|
| `task.add` | `{ task }` |
| `task.update` | `{ task, previous }` |
| `task.delete` | `{ taskId, task }` |
| `task.move` | `{ moved[], previous[] }` |
| `task.resize` | `{ task, previous, edge: 'start' \| 'end' }` |
| `task.progress` | `{ task, previous }` |
| `dependency.add` | `{ dependency }` |
| `dependency.update` | `{ dependency, previous }` |
| `dependency.remove` | `{ dependencyId, dependency }` |
| `resource.add` | `{ resource }` |
| `resource.update` | `{ resource, previous }` |
| `resource.remove` | `{ resourceId, resource }` |
| `marker.add` | `{ marker }` |
| `marker.update` | `{ marker, previous }` |
| `marker.remove` | `{ markerId, marker }` |
| `settings.change` | `{ settings, previous }` |
| `selection.change` | `{ selectedIds[], activeTaskId }` |

---

## TypeScript Types

### `GanttTask`

```ts
interface GanttTask {
  id: string;
  name: string;
  type: 'task' | 'milestone' | 'group';
  parentId: string | null;
  plannedStart: Date;
  plannedEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  progress: number;           // 0–100
  color?: string;             // CSS hex color
  collapsed?: boolean;        // groups only
  isCritical?: boolean;       // set by runCriticalPath
  wbs?: string;               // e.g. '1.2.3'
  location?: string;
  notes?: string;
}
```

### `Dependency`

```ts
interface Dependency {
  id: string;
  fromId: string;
  toId: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  offsetDays: number;
}
```

### `ResourceAllocation`

```ts
interface ResourceAllocation {
  id: string;
  taskId: string;
  resourceName: string;
  startDate: Date;
  endDate: Date;
  hours: number;
  departments: Department[];
  distribution: 'B-2' | 'B-1' | 'B0' | 'B+1' | 'B+2' | 'flat';
}
```

### `GanttSettings` (partial override via `initialSettings`)

```ts
interface GanttSettings {
  rowHeight: number;          // default 26
  columnWidth: number;        // default 28 (px per day at zoom 1)
  zoomFactor: number;         // default 1
  showHistogram: boolean;
  showDependencies: boolean;
  showBaseline: boolean;
  showCriticalPath: boolean;
  autoSchedule: boolean;
  histogramHeight: number;    // default 180
  taskListWidth: number;      // default 300
  theme: 'dark' | 'light';
  showGrid: boolean;
  showActualBars: boolean;
  visibleColumns: TaskListColumn[];  // default ['start', 'duration', 'progress']
}

type TaskListColumn = 'start' | 'end' | 'duration' | 'progress' | 'wbs' | 'location' | 'notes';
```

---

## GanttSettings Examples

### Compact view

```tsx
<GanttChart
  initialTasks={tasks}
  initialSettings={{
    rowHeight: 20,
    showHistogram: false,
    visibleColumns: ['duration', 'progress'],
  }}
/>
```

### Full audit view with all columns

```tsx
<GanttChart
  initialTasks={tasks}
  initialSettings={{
    rowHeight: 30,
    showActualBars: true,
    showBaseline: true,
    visibleColumns: ['start', 'end', 'duration', 'progress', 'wbs', 'location'],
  }}
/>
```

---

## Rescheduling

GanttRx automatically detects tasks that are behind schedule based on their expected progress vs actual progress. Tasks that are ≥ 10% behind their expected completion show:

- An **amber warning icon** (▲) in the task list next to the task name
- The task name turns **amber**
- They appear in the **Rescheduling Panel** (Auto Schedule button → opens panel with suggested new end dates)

---

## Dependency Types

| Type | Meaning |
|------|---------|
| **FS** | Finish-to-Start — successor can't start until predecessor finishes |
| **SS** | Start-to-Start — successor can't start until predecessor starts |
| **FF** | Finish-to-Finish — successor can't finish until predecessor finishes |
| **SF** | Start-to-Finish — successor can't finish until predecessor starts |

All types support an `offsetDays` lag (positive) or lead (negative).

---

## Distribution Curves

Resource hours are spread across the task duration using a Beta distribution:

| Curve | Shape |
|-------|-------|
| `B-2` | Heavy front-load (early peak) |
| `B-1` | Moderate front-load |
| `B0`  | Symmetric bell curve |
| `B+1` | Moderate back-load |
| `B+2` | Heavy back-load (late peak) |
| `flat`| Uniform distribution |

---

## User Interactions

| Action | How |
|--------|-----|
| Select task | Click a row or bar |
| Multi-select | Ctrl + Click |
| Open properties | Double-click a row or bar |
| Move task | Drag bar horizontally |
| Resize task | Drag left/right edge of bar |
| Change progress | Drag progress thumb on bar |
| Collapse group | Click ▼ / ▶ in the task list |
| Add dependency | Drag from the right handle of one bar to another |
| Scroll | Mouse wheel or trackpad on timeline/histogram |
| Zoom | Toolbar + / − buttons or Ctrl + scroll |
| Add columns | Click the **+** button in the task list header |

---

## Toolbar Quick Reference

| Button | Action |
|--------|--------|
| **+ Task** | Add a new leaf task |
| **⬛ Group** | Add a new group |
| **◆ Milestone** | Add a milestone |
| **Critical** | Toggle critical path highlight |
| **Histogram** | Show / hide resource histogram |
| **Deps** | Show / hide dependency arrows |
| **Baseline** | Show / hide baseline bars |
| **Grid** | Show / hide day grid |
| **Actual Bars** | Show / hide actual bars |
| **Auto Schedule** | Run CPM scheduler + open rescheduling panel |
| **Markers** | Add / remove timeline markers |
| **Today** | Scroll timeline to today |
| **PT / EN** | Toggle language |
| **PDF** | Export to PDF |
| **+** / **−** | Zoom in / out |

---

## Contributing

Pull requests are welcome. For major changes open an issue first.

```bash
git clone https://github.com/YOUR_USERNAME/ganttRx.git
cd ganttRx
pnpm install
pnpm dev          # start the demo app at localhost:5173
pnpm build:lib    # build the distributable library
```

---

## License

MIT

# 📊 PRD — React Gantt + Histogram Library

## 1. Overview

This project aims to build a high-performance **Gantt Chart + Histogram React library** using:
- **TypeScript**
- **React**
- **TailwindCSS**
- **shadcn/ui**

The library must support **large-scale datasets (5,000+ tasks)** with smooth performance and advanced scheduling capabilities.

---

## 2. Visual Identity (Reference)

Use the provided reference image as the **primary UI/UX guideline**:
- Dark-first design
- Neon accents (purple/blue/red tones)
- Compact grid layout
- Right-side properties panel
- Timeline grid with vertical markers
- Task bars with progress overlay

---

## 3. Core Features

### 3.1 Gantt Elements

- Tasks
- Milestones (dependency-enabled)
- Groups (auto-calculated start/end based on children)
- Sub-milestones

### 3.2 Task Properties

- Name
- Color
- Planned Start / End
- Actual Start / End
- Progress (visual overlay)
- Predecessors:
  - FS, SS, FF, SF
  - Offset (days)
- Location dropdown
- Resource Allocation

### 3.3 Interactions

- Drag to move tasks
- Resize start/end
- Double-click → open right panel
- Scroll behaviors:
  - Vertical: scroll tasks
  - Horizontal: shift + scroll
  - Zoom: ctrl + scroll (smooth transitions)
- Click + drag canvas (pan)

---

## 4. Histogram (Resource Allocation)

### Requirements

- Always visible below Gantt
- Same time scale alignment
- Stacked bars per task
- Based on resource allocation
- Two constant dotted reference lines

### Input Structure

```
{
  startDate,
  endDate,
  hours,
  department: [{ id, department, craftId }],
  distribution: 'B-2' | 'B-1' | 'B0' | 'B+1' | 'B+2' | 'flat'
}
```

### Distribution Logic (TypeScript)

Implement Beta Distribution:

```
function distribute(periods, total, alpha, beta)
```

Curves:
- B-2 → (2,5)
- B-1 → (3,4)
- B0 → (5,5)
- B+1 → (4,3)
- B+2 → (5,2)
- Flat → equal distribution

---

## 5. Auto Scheduling

### Features

- Dependency-based recalculation
- Critical Path calculation
- Use BOTH:
  - Planned dates
  - Actual dates

### Modes

- Global auto schedule
- Selected tasks auto schedule

---

## 6. Performance Requirements

- Handle 5,000+ rows
- Virtualized rendering (React Window / custom)
- Canvas or hybrid rendering for bars
- Avoid full re-renders
- Memoization strategy

---

## 7. UI Layout

### Left Panel

- Task list (table)

### Center

- Gantt timeline

### Bottom

- Histogram

### Right Panel (on double click)

- Editable task properties

---

## 8. Themes

- Light Mode
- Dark Mode (default)

---

## 9. API Design

### Main Component

```
<GanttChart
  tasks={[]}
  dependencies={[]}
  resources={[]}
  settings={{}}
/>
```

### Data Models

#### Task
```
{
  id,
  name,
  start,
  end,
  actualStart,
  actualEnd,
  progress,
  color,
  type: 'task' | 'milestone' | 'group',
  parentId
}
```

#### Dependency
```
{
  from,
  to,
  type: 'FS' | 'SS' | 'FF' | 'SF',
  offset
}
```

---

## 10. Project Phases

### Phase 1 — Foundation
- Setup project
- Design system (Tailwind + shadcn)
- Basic layout

### Phase 2 — Core Gantt
- Timeline rendering
- Task bars
- Zoom & scroll

### Phase 3 — Interaction
- Drag & resize
- Selection
- Double-click panel

### Phase 4 — Dependencies
- Draw links
- Dependency logic

### Phase 5 — Histogram
- Resource aggregation
- Beta distribution implementation
- Rendering stacked bars

### Phase 6 — Auto Scheduling
- Critical path
- Recalculation engine

### Phase 7 — Performance Optimization
- Virtualization
- Memoization

### Phase 8 — Theming
- Dark/Light mode

### Phase 9 — Documentation
- Installation guide
- API reference
- Examples

---

## 11. Documentation Requirements

- Full README
- Live examples
- Storybook integration
- Usage guides:
  - Basic usage
  - Advanced scheduling
  - Custom rendering

---

## 12. Success Criteria

- Smooth performance with 5k tasks
- Pixel-perfect UI vs reference
- Flexible API
- Accurate scheduling logic

---

## 13. Prompt Strategy for Claude

When using Claude:

- Always provide:
  - This PRD
  - UI reference image
  - Python distribution logic

### Suggested Prompt

"Build a production-ready React TypeScript Gantt + Histogram library following this PRD. Focus on performance, virtualization, and modular architecture. Match the UI style from the provided image. Implement resource distribution using the provided Python logic converted to TypeScript."


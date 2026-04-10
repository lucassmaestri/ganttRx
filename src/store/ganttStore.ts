import { create } from 'zustand';
import type { GanttTask, Dependency, ResourceAllocation, GanttSettings, GanttMarker } from '../types';
import { autoSchedule, computeCriticalPath } from '../lib/scheduler';
import { cascadeMove, recalcGroups, moveGroupWithChildren } from '../lib/ganttUtils';
import { addDays, startOfDay, differenceInCalendarDays } from 'date-fns';

const DEFAULT_SETTINGS: GanttSettings = {
  rowHeight: 26,
  columnWidth: 28,
  zoomFactor: 1,
  showHistogram: true,
  showDependencies: true,
  showBaseline: false,
  showCriticalPath: false,
  autoSchedule: false,
  histogramHeight: 180,
  taskListWidth: 300,
  theme: 'dark',
  showGrid: true,
  showActualBars: true,
  visibleColumns: ['start', 'duration', 'progress'],
};

interface GanttStore {
  tasks: GanttTask[];
  dependencies: Dependency[];
  resources: ResourceAllocation[];
  settings: GanttSettings;
  markers: GanttMarker[];

  setTasks: (tasks: GanttTask[]) => void;
  addTask: (task: GanttTask) => void;
  updateTask: (id: string, patch: Partial<GanttTask>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, newStart: Date) => void;
  resizeTask: (id: string, edge: 'start' | 'end', newDate: Date) => void;
  moveActual: (id: string, edge: 'start' | 'end' | 'move', newDate: Date) => void;
  toggleGroup: (id: string) => void;
  applyRescheduling: (suggestions: { taskId: string; suggestedEnd: Date }[]) => void;

  setDependencies: (deps: Dependency[]) => void;
  addDependency: (dep: Dependency) => void;
  removeDependency: (id: string) => void;
  updateDependency: (id: string, patch: Partial<Dependency>) => void;

  setResources: (res: ResourceAllocation[]) => void;
  addResource: (res: ResourceAllocation) => void;
  updateResource: (id: string, patch: Partial<ResourceAllocation>) => void;
  removeResource: (id: string) => void;

  setSettings: (patch: Partial<GanttSettings>) => void;
  runAutoSchedule: (selectedIds?: Set<string>) => void;
  runCriticalPath: () => void;

  addMarker: (marker: GanttMarker) => void;
  removeMarker: (id: string) => void;
  updateMarker: (id: string, patch: Partial<GanttMarker>) => void;
}

export const useGanttStore = create<GanttStore>((set, get) => ({
  tasks: [],
  dependencies: [],
  resources: [],
  settings: DEFAULT_SETTINGS,
  markers: [],

  setTasks: (tasks) => set({ tasks: recalcGroups(tasks) }),

  addTask: (task) => set(s => ({ tasks: recalcGroups([...s.tasks, task]) })),

  updateTask: (id, patch) => set(s => ({
    tasks: recalcGroups(s.tasks.map(t => t.id === id ? { ...t, ...patch } : t)),
  })),

  deleteTask: (id) => set(s => ({
    tasks: recalcGroups(s.tasks.filter(t => t.id !== id && t.parentId !== id)),
    dependencies: s.dependencies.filter(d => d.fromId !== id && d.toId !== id),
    resources: s.resources.filter(r => r.taskId !== id),
  })),

  moveTask: (id, newStart) => set(s => {
    const task = s.tasks.find(t => t.id === id);
    if (!task) return s;

    const newTasks = task.type === 'group'
      ? moveGroupWithChildren(s.tasks, id, newStart)
      : cascadeMove(s.tasks, s.dependencies, id, newStart);

    // Shift resources for EVERY task that changed position:
    // includes the moved task, cascaded dependents, and all group descendants.
    const oldMap = new Map(s.tasks.map(t => [t.id, t]));
    const shifts = new Map<string, number>();
    for (const t of newTasks) {
      const old = oldMap.get(t.id);
      if (!old) continue;
      const delta = t.plannedStart.getTime() - old.plannedStart.getTime();
      if (delta !== 0) shifts.set(t.id, delta);
    }
    const newResources = s.resources.map(r => {
      const delta = shifts.get(r.taskId);
      if (delta === undefined) return r;
      return { ...r, startDate: new Date(r.startDate.getTime() + delta), endDate: new Date(r.endDate.getTime() + delta) };
    });

    return { tasks: newTasks, resources: newResources };
  }),

  resizeTask: (id, edge, newDate) => set(s => {
    const task = s.tasks.find(t => t.id === id);
    if (!task) return s;

    const oldStart = task.plannedStart.getTime();
    const oldEnd   = task.plannedEnd.getTime();
    const oldDur   = Math.max(oldEnd - oldStart, 1);

    let newTask: GanttTask;
    if (edge === 'start') {
      const start = startOfDay(newDate);
      if (start >= task.plannedEnd) return s;
      newTask = { ...task, plannedStart: start };
    } else {
      const end = startOfDay(newDate);
      if (end <= task.plannedStart) return s;
      newTask = { ...task, plannedEnd: end };
    }

    const newTaskStart = newTask.plannedStart.getTime();
    const newTaskEnd   = newTask.plannedEnd.getTime();
    const newDur       = Math.max(newTaskEnd - newTaskStart, 1);

    // Scale resources proportionally within the new task bounds
    const newResources = s.resources.map(r => {
      if (r.taskId !== id) return r;
      const relStart = (r.startDate.getTime() - oldStart) / oldDur;
      const relEnd   = (r.endDate.getTime()   - oldStart) / oldDur;
      return {
        ...r,
        startDate: new Date(newTaskStart + relStart * newDur),
        endDate:   new Date(newTaskStart + relEnd   * newDur),
      };
    });

    // Cascade: propagate new task end to FS/FF/SF dependents
    const tasksAfterResize = recalcGroups(s.tasks.map(t => t.id === id ? newTask : t));
    const tasksAfterCascade = cascadeMove(tasksAfterResize, s.dependencies, id, newTask.plannedStart);

    // Shift resources for any tasks that cascadeMove pushed forward
    const oldMap = new Map(s.tasks.map(t => [t.id, t]));
    const finalResources = newResources.map(r => {
      if (r.taskId === id) return r; // already handled proportionally above
      const newT = tasksAfterCascade.find(t => t.id === r.taskId);
      const oldT = oldMap.get(r.taskId);
      if (!newT || !oldT) return r;
      const delta = newT.plannedStart.getTime() - oldT.plannedStart.getTime();
      if (delta === 0) return r;
      return { ...r, startDate: new Date(r.startDate.getTime() + delta), endDate: new Date(r.endDate.getTime() + delta) };
    });

    return { tasks: tasksAfterCascade, resources: finalResources };
  }),

  moveActual: (id, edge, newDate) => set(s => ({
    tasks: s.tasks.map(t => {
      if (t.id !== id) return t;
      if (edge === 'move') {
        const dur = t.actualEnd && t.actualStart
          ? differenceInCalendarDays(t.actualEnd, t.actualStart)
          : 0;
        const start = startOfDay(newDate);
        return { ...t, actualStart: start, actualEnd: addDays(start, dur) };
      } else if (edge === 'start') {
        return { ...t, actualStart: startOfDay(newDate) };
      } else {
        return { ...t, actualEnd: startOfDay(newDate) };
      }
    }),
  })),

  toggleGroup: (id) => set(s => ({
    tasks: s.tasks.map(t => t.id === id ? { ...t, collapsed: !t.collapsed } : t),
  })),

  applyRescheduling: (suggestions) => set(s => ({
    tasks: recalcGroups(s.tasks.map(t => {
      const sug = suggestions.find(s => s.taskId === t.id);
      if (!sug) return t;
      return { ...t, plannedEnd: sug.suggestedEnd };
    })),
  })),

  setDependencies: (dependencies) => set({ dependencies }),
  addDependency: (dep) => set(s => ({ dependencies: [...s.dependencies, dep] })),
  removeDependency: (id) => set(s => ({ dependencies: s.dependencies.filter(d => d.id !== id) })),
  updateDependency: (id, patch) => set(s => ({
    dependencies: s.dependencies.map(d => d.id === id ? { ...d, ...patch } : d),
  })),

  setResources: (resources) => set({ resources }),
  addResource: (res) => set(s => ({ resources: [...s.resources, res] })),
  updateResource: (id, patch) => set(s => ({
    resources: s.resources.map(r => r.id === id ? { ...r, ...patch } : r),
  })),
  removeResource: (id) => set(s => ({ resources: s.resources.filter(r => r.id !== id) })),

  setSettings: (patch) => set(s => ({ settings: { ...s.settings, ...patch } })),

  runAutoSchedule: (selectedIds) => {
    const { tasks, dependencies } = get();
    const updated = autoSchedule(tasks, dependencies, selectedIds);
    set({ tasks: recalcGroups(updated) });
  },

  runCriticalPath: () => {
    const { tasks, dependencies } = get();
    const updated = computeCriticalPath(tasks, dependencies);
    set({ tasks: updated });
  },

  addMarker: (marker) => set(s => ({ markers: [...s.markers, marker] })),
  removeMarker: (id) => set(s => ({ markers: s.markers.filter(m => m.id !== id) })),
  updateMarker: (id, patch) => set(s => ({
    markers: s.markers.map(m => m.id === id ? { ...m, ...patch } : m),
  })),
}));

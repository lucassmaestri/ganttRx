import { create } from 'zustand';
import type { GanttTask, Dependency, ResourceAllocation, GanttSettings, GanttMarker } from '../types';
import { autoSchedule, computeCriticalPath } from '../lib/scheduler';
import { cascadeMove, recalcGroups, shiftResources, moveGroupWithChildren } from '../lib/ganttUtils';
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
    const deltaMs = startOfDay(newStart).getTime() - startOfDay(task.plannedStart).getTime();
    const newTasks = task.type === 'group'
      ? moveGroupWithChildren(s.tasks, id, newStart)
      : cascadeMove(s.tasks, s.dependencies, id, newStart);
    // Shift resources for the group's children too
    let newResources = s.resources;
    if (task.type === 'group') {
      newResources = s.resources.map(r => {
        const child = newTasks.find(t => t.id === r.taskId && t.parentId === id);
        if (!child) return r;
        return { ...r, startDate: new Date(r.startDate.getTime() + deltaMs), endDate: new Date(r.endDate.getTime() + deltaMs) };
      });
    } else {
      newResources = shiftResources(s.resources, id, deltaMs);
    }
    return { tasks: newTasks, resources: newResources };
  }),

  resizeTask: (id, edge, newDate) => set(s => ({
    tasks: recalcGroups(s.tasks.map(t => {
      if (t.id !== id) return t;
      if (edge === 'start') {
        const start = startOfDay(newDate);
        if (start >= t.plannedEnd) return t;
        return { ...t, plannedStart: start };
      } else {
        const end = startOfDay(newDate);
        if (end <= t.plannedStart) return t;
        return { ...t, plannedEnd: end };
      }
    })),
  })),

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

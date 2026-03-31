import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { GanttTask, GanttSettings, Dependency, ResourceAllocation, GanttMarker } from '../../types';
import type { GanttChangeEvent, GanttEventType, GanttSnapshot } from '../../types/events';
import { useGanttStore } from '../../store/ganttStore';
import { useSelectionStore } from '../../store/selectionStore';
import { Toolbar } from '../Toolbar/Toolbar';
import { TaskList } from '../TaskList/TaskList';
import { Timeline } from '../Timeline/Timeline';
import { Histogram } from '../Histogram/Histogram';
import { PropertiesPanel } from '../PropertiesPanel/PropertiesPanel';
import { ReschedulingPanel } from '../ReschedulingPanel/ReschedulingPanel';
import { addDays } from 'date-fns';

export interface GanttChartProps {
  // ── Initial data (loaded once on mount) ─────────────────────────────────
  initialTasks?:        GanttTask[];
  initialDependencies?: Dependency[];
  initialResources?:    ResourceAllocation[];
  initialMarkers?:      GanttMarker[];
  initialSettings?:     Partial<GanttSettings>;

  // ── Generic event stream — fired on every state change ────────────────
  onEvent?: <T extends GanttEventType>(event: GanttChangeEvent<T>) => void;

  // ── Specific convenience callbacks ────────────────────────────────────
  onTaskAdd?:           (task: GanttTask) => void;
  onTaskUpdate?:        (task: GanttTask, previous: GanttTask) => void;
  onTaskDelete?:        (taskId: string, task: GanttTask) => void;
  onTaskMove?:          (moved: GanttTask[], previous: GanttTask[]) => void;
  onTaskResize?:        (task: GanttTask, previous: GanttTask, edge: 'start' | 'end') => void;
  onTaskProgress?:      (task: GanttTask, previous: GanttTask) => void;
  onDependencyAdd?:     (dep: Dependency) => void;
  onDependencyUpdate?:  (dep: Dependency, previous: Dependency) => void;
  onDependencyRemove?:  (depId: string, dep: Dependency) => void;
  onResourceAdd?:       (res: ResourceAllocation) => void;
  onResourceUpdate?:    (res: ResourceAllocation, previous: ResourceAllocation) => void;
  onResourceRemove?:    (resId: string, res: ResourceAllocation) => void;
  onMarkerAdd?:         (marker: GanttMarker) => void;
  onMarkerUpdate?:      (marker: GanttMarker, previous: GanttMarker) => void;
  onMarkerRemove?:      (markerId: string, marker: GanttMarker) => void;
  onSettingsChange?:    (settings: GanttSettings) => void;
  onSelectionChange?:   (selectedIds: string[], activeTaskId: string | null) => void;

  /** @deprecated use initialSettings */
  settings?: Partial<GanttSettings>;
}

export const GanttChart: React.FC<GanttChartProps> = ({
  initialTasks,
  initialDependencies,
  initialResources,
  initialMarkers,
  initialSettings,
  onEvent,
  onTaskAdd, onTaskUpdate, onTaskDelete, onTaskMove, onTaskResize, onTaskProgress,
  onDependencyAdd, onDependencyUpdate, onDependencyRemove,
  onResourceAdd, onResourceUpdate, onResourceRemove,
  onMarkerAdd, onMarkerUpdate, onMarkerRemove,
  onSettingsChange, onSelectionChange,
  settings: _settings,
}) => {
  const storeTasks = useGanttStore(s => s.tasks);
  const settings   = useGanttStore(s => s.settings);
  const addTask    = useGanttStore(s => s.addTask);
  const isPanelOpen = useSelectionStore(s => s.isPanelOpen);
  const [showRescheduling, setShowRescheduling] = useState(false);
  const [histogramHeight, setHistogramHeight] = useState(settings.histogramHeight);
  const resizeDragRef = useRef<{ startY: number; startH: number } | null>(null);

  const setSettings = useGanttStore(s => s.setSettings);

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    resizeDragRef.current = { startY: e.clientY, startH: histogramHeight };
    const onMove = (ev: MouseEvent) => {
      if (!resizeDragRef.current) return;
      const delta = resizeDragRef.current.startY - ev.clientY;
      const newH = Math.max(60, Math.min(500, resizeDragRef.current.startH + delta));
      setHistogramHeight(newH);
      setSettings({ histogramHeight: newH });
    };
    const onUp = () => {
      resizeDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Flatten: hide children of collapsed groups
  const flatTasks = useMemo(() => {
    const collapsed = new Set(
      storeTasks.filter(t => t.type === 'group' && t.collapsed).map(t => t.id)
    );
    return storeTasks.filter(t => !t.parentId || !collapsed.has(t.parentId));
  }, [storeTasks]);

  const handleAddTask = () => addTask({
    id: `task-${Date.now()}`,
    name: `Task ${storeTasks.filter(t => t.type === 'task').length + 1}`,
    type: 'task', parentId: null,
    plannedStart: new Date(), plannedEnd: addDays(new Date(), 7),
    progress: 0, color: '#e05252',
  });

  const handleAddGroup = () => addTask({
    id: `group-${Date.now()}`,
    name: `Group ${storeTasks.filter(t => t.type === 'group').length + 1}`,
    type: 'group', parentId: null,
    plannedStart: new Date(), plannedEnd: addDays(new Date(), 30),
    progress: 0, color: '#4f46e5', collapsed: false,
  });

  const handleAddMilestone = () => addTask({
    id: `ms-${Date.now()}`,
    name: `Milestone ${storeTasks.filter(t => t.type === 'milestone').length + 1}`,
    type: 'milestone', parentId: null,
    plannedStart: addDays(new Date(), 14), plannedEnd: addDays(new Date(), 14),
    progress: 0, color: '#f59e0b',
  });

  // ── Load initial data on mount ──────────────────────────────────────────
  const didLoadRef = useRef(false);
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    const s = useGanttStore.getState();
    if (initialTasks)        s.setTasks(initialTasks);
    if (initialDependencies) s.setDependencies(initialDependencies);
    if (initialResources)    s.setResources(initialResources);
    if (initialMarkers)      initialMarkers.forEach(m => s.addMarker(m));
    if (initialSettings)     s.setSettings(initialSettings);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Change event subscription ────────────────────────────────────────────
  const callbacksRef = useRef({
    onEvent, onTaskAdd, onTaskUpdate, onTaskDelete, onTaskMove, onTaskResize, onTaskProgress,
    onDependencyAdd, onDependencyUpdate, onDependencyRemove,
    onResourceAdd, onResourceUpdate, onResourceRemove,
    onMarkerAdd, onMarkerUpdate, onMarkerRemove,
    onSettingsChange, onSelectionChange,
  });
  // Keep callbacks ref up-to-date without resubscribing
  useEffect(() => {
    callbacksRef.current = {
      onEvent, onTaskAdd, onTaskUpdate, onTaskDelete, onTaskMove, onTaskResize, onTaskProgress,
      onDependencyAdd, onDependencyUpdate, onDependencyRemove,
      onResourceAdd, onResourceUpdate, onResourceRemove,
      onMarkerAdd, onMarkerUpdate, onMarkerRemove,
      onSettingsChange, onSelectionChange,
    };
  });

  useEffect(() => {
    const makeSnapshot = (): GanttSnapshot => {
      const gs = useGanttStore.getState();
      return { tasks: gs.tasks, dependencies: gs.dependencies, resources: gs.resources, markers: gs.markers, settings: gs.settings };
    };

    const fire = (type: GanttEventType, payload: unknown) => {
      if (!callbacksRef.current.onEvent) return;
      const event = { type, payload, snapshot: makeSnapshot(), timestamp: Date.now() };
      (callbacksRef.current.onEvent as (e: unknown) => void)(event);
    };

    let prev = useGanttStore.getState();

    const unsubGantt = useGanttStore.subscribe((next) => {
      const cb = callbacksRef.current;

      // ── Tasks ──
      if (next.tasks !== prev.tasks) {
        const prevMap = new Map(prev.tasks.map(t => [t.id, t]));
        const nextMap = new Map(next.tasks.map(t => [t.id, t]));

        const moved: GanttTask[] = [];
        const movedPrev: GanttTask[] = [];

        for (const [id, task] of nextMap) {
          if (!prevMap.has(id)) {
            fire('task.add', { task });
            cb.onTaskAdd?.(task);
          } else {
            const p = prevMap.get(id)!;
            if (task === p) continue;
            const startChanged = task.plannedStart.getTime() !== p.plannedStart.getTime();
            const endChanged   = task.plannedEnd.getTime()   !== p.plannedEnd.getTime();
            const progChanged  = task.progress !== p.progress;
            if (startChanged || endChanged) {
              moved.push(task); movedPrev.push(p);
              if (startChanged && endChanged && (task.plannedEnd.getTime() - task.plannedStart.getTime()) === (p.plannedEnd.getTime() - p.plannedStart.getTime())) {
                // same duration → move (handled below via moved array)
              } else if (startChanged && !endChanged) {
                fire('task.resize', { task, previous: p, edge: 'start' });
                cb.onTaskResize?.(task, p, 'start');
              } else if (!startChanged && endChanged) {
                fire('task.resize', { task, previous: p, edge: 'end' });
                cb.onTaskResize?.(task, p, 'end');
              }
            } else if (progChanged) {
              fire('task.progress', { task, previous: p });
              cb.onTaskProgress?.(task, p);
            } else {
              fire('task.update', { task, previous: p });
              cb.onTaskUpdate?.(task, p);
            }
          }
        }
        if (moved.length > 0) {
          fire('task.move', { moved, previous: movedPrev });
          cb.onTaskMove?.(moved, movedPrev);
        }
        for (const [id, task] of prevMap) {
          if (!nextMap.has(id)) {
            fire('task.delete', { taskId: id, task });
            cb.onTaskDelete?.(id, task);
          }
        }
      }

      // ── Dependencies ──
      if (next.dependencies !== prev.dependencies) {
        const prevMap = new Map(prev.dependencies.map(d => [d.id, d]));
        const nextMap = new Map(next.dependencies.map(d => [d.id, d]));
        for (const [id, dep] of nextMap) {
          if (!prevMap.has(id)) { fire('dependency.add', { dependency: dep }); cb.onDependencyAdd?.(dep); }
          else if (dep !== prevMap.get(id)) { const p = prevMap.get(id)!; fire('dependency.update', { dependency: dep, previous: p }); cb.onDependencyUpdate?.(dep, p); }
        }
        for (const [id, dep] of prevMap) {
          if (!nextMap.has(id)) { fire('dependency.remove', { dependencyId: id, dependency: dep }); cb.onDependencyRemove?.(id, dep); }
        }
      }

      // ── Resources ──
      if (next.resources !== prev.resources) {
        const prevMap = new Map(prev.resources.map(r => [r.id, r]));
        const nextMap = new Map(next.resources.map(r => [r.id, r]));
        for (const [id, res] of nextMap) {
          if (!prevMap.has(id)) { fire('resource.add', { resource: res }); cb.onResourceAdd?.(res); }
          else if (res !== prevMap.get(id)) { const p = prevMap.get(id)!; fire('resource.update', { resource: res, previous: p }); cb.onResourceUpdate?.(res, p); }
        }
        for (const [id, res] of prevMap) {
          if (!nextMap.has(id)) { fire('resource.remove', { resourceId: id, resource: res }); cb.onResourceRemove?.(id, res); }
        }
      }

      // ── Markers ──
      if (next.markers !== prev.markers) {
        const prevMap = new Map(prev.markers.map(m => [m.id, m]));
        const nextMap = new Map(next.markers.map(m => [m.id, m]));
        for (const [id, mk] of nextMap) {
          if (!prevMap.has(id)) { fire('marker.add', { marker: mk }); cb.onMarkerAdd?.(mk); }
          else if (mk !== prevMap.get(id)) { const p = prevMap.get(id)!; fire('marker.update', { marker: mk, previous: p }); cb.onMarkerUpdate?.(mk, p); }
        }
        for (const [id, mk] of prevMap) {
          if (!nextMap.has(id)) { fire('marker.remove', { markerId: id, marker: mk }); cb.onMarkerRemove?.(id, mk); }
        }
      }

      // ── Settings ──
      if (next.settings !== prev.settings) {
        fire('settings.change', { settings: next.settings, previous: prev.settings });
        cb.onSettingsChange?.(next.settings);
      }

      prev = next;
    });

    // Selection store subscription
    let prevSel = useSelectionStore.getState();
    const unsubSel = useSelectionStore.subscribe((next) => {
      if (next.selectedIds !== prevSel.selectedIds || next.activeTaskId !== prevSel.activeTaskId) {
        const ids = [...next.selectedIds];
        fire('selection.change', { selectedIds: ids, activeTaskId: next.activeTaskId });
        callbacksRef.current.onSelectionChange?.(ids, next.activeTaskId);
      }
      prevSel = next;
    });

    return () => { unsubGantt(); unsubSel(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0f', overflow: 'hidden' }}>
      <Toolbar
        onAddTask={handleAddTask}
        onAddGroup={handleAddGroup}
        onAddMilestone={handleAddMilestone}
        onOpenRescheduling={() => setShowRescheduling(true)}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
            <TaskList tasks={flatTasks} width={settings.taskListWidth} />
            <Timeline tasks={flatTasks} />
          </div>
          {settings.showHistogram && (
            <>
              <div
                onMouseDown={onResizeStart}
                style={{
                  height: 4,
                  cursor: 'row-resize',
                  background: 'rgba(255,255,255,0.06)',
                  flexShrink: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.4)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              />
              <Histogram height={histogramHeight} leftOffset={settings.taskListWidth} />
            </>
          )}
        </div>
        {isPanelOpen && <PropertiesPanel />}
      </div>

      {showRescheduling && <ReschedulingPanel onClose={() => setShowRescheduling(false)} />}
    </div>
  );
};

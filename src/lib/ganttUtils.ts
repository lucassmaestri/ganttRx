import type { GanttTask, Dependency, DependencyType, ResourceAllocation } from '../types';
import { addDays, startOfDay, differenceInCalendarDays } from 'date-fns';

// ─── Cascade: propagate a task move through its dependency chain ───────────
export function cascadeMove(
  tasks: GanttTask[],
  dependencies: Dependency[],
  movedId: string,
  newStart: Date,
): GanttTask[] {
  // Use original task refs — only spread when actually modifying a task
  const taskMap = new Map<string, GanttTask>(tasks.map(t => [t.id, t]));

  // Adjacency list
  const adj = new Map<string, string[]>();
  for (const t of tasks) adj.set(t.id, []);
  for (const dep of dependencies) adj.get(dep.fromId)?.push(dep.toId);

  // Pre-build dep lookup to avoid O(deps) linear scan inside BFS
  const depLookup = new Map<string, Dependency>();
  for (const dep of dependencies) depLookup.set(`${dep.fromId}→${dep.toId}`, dep);

  // Update the moved task
  const movedTask = taskMap.get(movedId)!;
  const dur = Math.max(0, differenceInCalendarDays(movedTask.plannedEnd, movedTask.plannedStart));
  const start = startOfDay(newStart);
  taskMap.set(movedId, { ...movedTask, plannedStart: start, plannedEnd: addDays(start, dur) });

  // BFS forward propagation
  // visited tracks whether a node is queued; we always update positions but only enqueue once.
  // We never pull a task earlier than its current scheduled start (deps only PUSH forward).
  const queue = [movedId];
  const queued = new Set<string>([movedId]);

  while (queue.length) {
    const fromId = queue.shift()!;
    const fromTask = taskMap.get(fromId)!;

    for (const toId of (adj.get(fromId) ?? [])) {
      const dep = depLookup.get(`${fromId}→${toId}`);
      if (!dep) continue;

      const toTask = taskMap.get(toId)!;
      const toDur = Math.max(0, differenceInCalendarDays(toTask.plannedEnd, toTask.plannedStart));
      const newToStart = computeDepStart(fromTask, toTask, dep.type, dep.offsetDays);
      const newToStartDay = startOfDay(newToStart);

      // Only push forward — never pull a task to an earlier date via cascade
      if (newToStartDay > toTask.plannedStart) {
        taskMap.set(toId, {
          ...toTask,
          plannedStart: newToStartDay,
          plannedEnd: addDays(newToStartDay, toDur),
        });
        // Re-enqueue even if already queued so updated position propagates downstream
        if (!queued.has(toId)) {
          queued.add(toId);
          queue.push(toId);
        }
      }
    }
  }

  // Reconstruct: preserve original references for unmodified tasks
  return recalcGroups(tasks.map(t => taskMap.get(t.id)!));
}

function computeDepStart(
  from: GanttTask,
  to: GanttTask,
  type: DependencyType,
  offsetDays: number,
): Date {
  const toDur = Math.max(0, differenceInCalendarDays(to.plannedEnd, to.plannedStart));
  switch (type) {
    case 'FS': return addDays(from.plannedEnd, 1 + offsetDays);
    case 'SS': return addDays(from.plannedStart, offsetDays);
    case 'FF': return addDays(addDays(from.plannedEnd, offsetDays), -toDur);
    case 'SF': return addDays(addDays(from.plannedStart, 1 + offsetDays), -toDur);
    default:   return addDays(from.plannedEnd, 1);
  }
}

// ─── Recalculate group start/end from children — O(n), no unnecessary spreads
export function recalcGroups(tasks: GanttTask[]): GanttTask[] {
  // Build parent→children index in a single O(n) pass
  const childrenByParent = new Map<string, GanttTask[]>();
  for (const t of tasks) {
    if (!t.parentId) continue;
    let arr = childrenByParent.get(t.parentId);
    if (!arr) { arr = []; childrenByParent.set(t.parentId, arr); }
    arr.push(t);
  }

  // Only create new objects for groups whose bounds actually changed
  let anyChanged = false;
  const result = tasks.map(t => {
    if (t.type !== 'group') return t;                        // no-op for non-groups
    const children = childrenByParent.get(t.id);
    if (!children || children.length === 0) return t;       // no-op for empty groups

    let minMs = Infinity, maxMs = -Infinity;
    for (const c of children) {
      const s = c.plannedStart.getTime();
      const e = c.plannedEnd.getTime();
      if (s < minMs) minMs = s;
      if (e > maxMs) maxMs = e;
    }

    // Return original ref if bounds haven't changed
    if (minMs === t.plannedStart.getTime() && maxMs === t.plannedEnd.getTime()) return t;

    anyChanged = true;
    return { ...t, plannedStart: new Date(minMs), plannedEnd: new Date(maxMs) };
  });

  // Return original array if nothing changed (preserves referential equality → no React re-render)
  return anyChanged ? result : tasks;
}

// ─── Shift resource allocations when their task moves ──────────────────────
export function shiftResources(
  resources: ResourceAllocation[],
  taskId: string,
  deltaMs: number,
): ResourceAllocation[] {
  return resources.map(r => {
    if (r.taskId !== taskId) return r;
    return {
      ...r,
      startDate: new Date(r.startDate.getTime() + deltaMs),
      endDate:   new Date(r.endDate.getTime() + deltaMs),
    };
  });
}

// ─── Move a group and ALL its descendants by the same delta ───────────────
export function moveGroupWithChildren(
  tasks: GanttTask[],
  groupId: string,
  newStart: Date,
): GanttTask[] {
  const group = tasks.find(t => t.id === groupId);
  if (!group) return tasks;
  const deltaMs = startOfDay(newStart).getTime() - startOfDay(group.plannedStart).getTime();
  if (deltaMs === 0) return tasks;

  const descendants = new Set<string>();
  const collect = (parentId: string) => {
    for (const t of tasks) {
      if (t.parentId === parentId) {
        descendants.add(t.id);
        if (t.type === 'group') collect(t.id);
      }
    }
  };
  collect(groupId);

  return tasks.map(t => {
    if (t.id !== groupId && !descendants.has(t.id)) return t;
    return {
      ...t,
      plannedStart:  new Date(t.plannedStart.getTime() + deltaMs),
      plannedEnd:    new Date(t.plannedEnd.getTime() + deltaMs),
      actualStart:   t.actualStart  ? new Date(t.actualStart.getTime() + deltaMs)  : undefined,
      actualEnd:     t.actualEnd    ? new Date(t.actualEnd.getTime() + deltaMs)    : undefined,
    };
  });
}

// ─── Rescheduling analysis ─────────────────────────────────────────────────
export function analyzeRescheduling(tasks: GanttTask[]) {
  const today = new Date();

  return tasks
    .filter(t => t.type === 'task')
    .map(t => {
      const totalMs = t.plannedEnd.getTime() - t.plannedStart.getTime();
      const elapsedMs = today.getTime() - t.plannedStart.getTime();
      if (elapsedMs <= 0 || totalMs <= 0) return null;

      const expectedProgress = Math.min(100, (elapsedMs / totalMs) * 100);
      const gap = expectedProgress - t.progress;

      if (gap < 10) return null;

      const delayDays = Math.ceil((gap / 100) * (totalMs / 86400000));
      const suggestedEnd = addDays(t.plannedEnd, delayDays);

      return {
        taskId: t.id,
        taskName: t.name,
        currentEnd: t.plannedEnd,
        suggestedEnd,
        delayDays,
        reason: `${Math.round(gap)}% behind schedule (expected ${Math.round(expectedProgress)}%, actual ${t.progress}%)`,
      };
    })
    .filter(Boolean) as {
      taskId: string;
      taskName: string;
      currentEnd: Date;
      suggestedEnd: Date;
      delayDays: number;
      reason: string;
    }[];
}

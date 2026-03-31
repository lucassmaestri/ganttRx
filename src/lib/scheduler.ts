import type { GanttTask, Dependency, DependencyType } from '../types';
import { addDays, startOfDay, differenceInCalendarDays } from 'date-fns';

function duration(task: GanttTask): number {
  return Math.max(1, differenceInCalendarDays(task.plannedEnd, task.plannedStart) + 1);
}

function applyDependency(
  predEnd: Date,
  predStart: Date,
  type: DependencyType,
  offsetDays: number
): Date {
  switch (type) {
    case 'FS': return addDays(predEnd, 1 + offsetDays);
    case 'SS': return addDays(predStart, offsetDays);
    case 'FF': return addDays(predEnd, offsetDays);
    case 'SF': return addDays(predStart, 1 + offsetDays);
    default:   return addDays(predEnd, 1);
  }
}

export function autoSchedule(
  tasks: GanttTask[],
  dependencies: Dependency[],
  selectedIds?: Set<string>
): GanttTask[] {
  const taskMap = new Map(tasks.map(t => [t.id, { ...t }]));

  // Topological sort
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const t of tasks) {
    inDegree.set(t.id, 0);
    adj.set(t.id, []);
  }
  for (const dep of dependencies) {
    inDegree.set(dep.toId, (inDegree.get(dep.toId) ?? 0) + 1);
    adj.get(dep.fromId)?.push(dep.toId);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of (adj.get(id) ?? [])) {
      const deg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }

  // Forward pass
  for (const id of order) {
    if (selectedIds && !selectedIds.has(id)) continue;
    const task = taskMap.get(id)!;
    const dur = duration(task);
    const preds = dependencies.filter(d => d.toId === id);

    let earliest: Date | null = null;
    for (const dep of preds) {
      const pred = taskMap.get(dep.fromId);
      if (!pred) continue;
      const candidate = applyDependency(pred.plannedEnd, pred.plannedStart, dep.type, dep.offsetDays);
      if (!earliest || candidate > earliest) earliest = candidate;
    }

    if (earliest) {
      const start = startOfDay(earliest);
      task.plannedStart = start;
      task.plannedEnd = addDays(start, dur - 1);
    }
  }

  return Array.from(taskMap.values());
}

export function computeCriticalPath(
  tasks: GanttTask[],
  dependencies: Dependency[]
): GanttTask[] {
  const taskMap = new Map(tasks.map(t => [t.id, { ...t }]));
  const adj = new Map<string, string[]>();
  const radj = new Map<string, string[]>();

  for (const t of tasks) { adj.set(t.id, []); radj.set(t.id, []); }
  for (const dep of dependencies) {
    adj.get(dep.fromId)?.push(dep.toId);
    radj.get(dep.toId)?.push(dep.fromId);
  }

  // ES/EF forward pass
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  const inDeg = new Map<string, number>();
  for (const t of tasks) inDeg.set(t.id, 0);
  for (const dep of dependencies) inDeg.set(dep.toId, (inDeg.get(dep.toId) ?? 0) + 1);

  const queue: string[] = [];
  for (const [id, deg] of inDeg) {
    if (deg === 0) { es.set(id, 0); queue.push(id); }
  }

  let maxEF = 0;
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    const t = taskMap.get(id)!;
    const dur = duration(t);
    const start = es.get(id) ?? 0;
    const finish = start + dur;
    ef.set(id, finish);
    if (finish > maxEF) maxEF = finish;

    for (const next of (adj.get(id) ?? [])) {
      const cur = es.get(next) ?? 0;
      if (finish > cur) es.set(next, finish);
      const deg = (inDeg.get(next) ?? 1) - 1;
      inDeg.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }

  // LS/LF backward pass
  const ls = new Map<string, number>();
  const lf = new Map<string, number>();
  for (const id of order) lf.set(id, maxEF);

  for (const id of [...order].reverse()) {
    const t = taskMap.get(id)!;
    const dur = duration(t);
    const lateFin = lf.get(id) ?? maxEF;
    ls.set(id, lateFin - dur);

    for (const pred of (radj.get(id) ?? [])) {
      const cur = lf.get(pred) ?? maxEF;
      const candidate = ls.get(id) ?? maxEF;
      if (candidate < cur) lf.set(pred, candidate);
    }
  }

  // Mark critical (float = 0)
  return Array.from(taskMap.values()).map(t => ({
    ...t,
    isCritical: (ls.get(t.id) ?? 0) - (es.get(t.id) ?? 0) === 0,
  }));
}

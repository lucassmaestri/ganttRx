import type { GanttTask, Dependency, ResourceAllocation, DependencyType, DistributionCurve } from '../types';
import { addDays } from 'date-fns';

const BASE = new Date(2025, 0, 1);
function d(offset: number): Date { return addDays(BASE, offset); }

// ─── Small dataset (original) ─────────────────────────────────────────────
export const mockTasks: GanttTask[] = [
  { id: 'g1', name: 'Group 1', type: 'group', parentId: null, plannedStart: d(0),  plannedEnd: d(60),  progress: 67, color: '#4f46e5', collapsed: false },
  { id: 't1', name: 'Task 1',  type: 'task',  parentId: 'g1', plannedStart: d(0),  plannedEnd: d(14),  progress: 100, color: '#e05252' },
  { id: 't2', name: 'Task 2',  type: 'task',  parentId: 'g1', plannedStart: d(5),  plannedEnd: d(20),  progress: 80,  color: '#e05252' },
  { id: 'm1', name: 'Milestone 1', type: 'milestone', parentId: 'g1', plannedStart: d(21), plannedEnd: d(21), progress: 0, color: '#f59e0b' },
  { id: 't3', name: 'Task 3',  type: 'task',  parentId: 'g1', plannedStart: d(22), plannedEnd: d(40),  progress: 60, color: '#e05252' },
  { id: 't4', name: 'Task 4',  type: 'task',  parentId: 'g1', plannedStart: d(30), plannedEnd: d(50),  progress: 45, color: '#e05252' },
  { id: 't5', name: 'Task 5',  type: 'task',  parentId: 'g1', plannedStart: d(40), plannedEnd: d(60),  progress: 20, color: '#e05252' },
  { id: 'g2', name: 'Group 2', type: 'group', parentId: null, plannedStart: d(15), plannedEnd: d(90),  progress: 5,  color: '#4f46e5', collapsed: false },
  { id: 't6',  name: 'Task 6',  type: 'task', parentId: 'g2', plannedStart: d(15), plannedEnd: d(25),  progress: 97, color: '#e05252' },
  { id: 't7',  name: 'Task 7',  type: 'task', parentId: 'g2', plannedStart: d(15), plannedEnd: d(28),  progress: 59, color: '#e05252' },
  { id: 't8',  name: 'Task 8',  type: 'task', parentId: 'g2', plannedStart: d(20), plannedEnd: d(35),  progress: 98, color: '#e05252' },
  { id: 't9',  name: 'Task 9',  type: 'task', parentId: 'g2', plannedStart: d(20), plannedEnd: d(30),  progress: 41, color: '#e05252' },
  { id: 't10', name: 'Task 10', type: 'task', parentId: 'g2', plannedStart: d(20), plannedEnd: d(32),  progress: 22, color: '#e05252' },
  { id: 't11', name: 'Task 11', type: 'task', parentId: 'g2', plannedStart: d(20), plannedEnd: d(34),  progress: 45, color: '#e05252' },
  { id: 't12', name: 'Task 12', type: 'task', parentId: 'g2', plannedStart: d(20), plannedEnd: d(37),  progress: 56, color: '#e05252' },
  { id: 't13', name: 'Task 13', type: 'task', parentId: 'g2', plannedStart: d(20), plannedEnd: d(40),  progress: 56, color: '#e05252' },
  { id: 't14', name: 'Task 14', type: 'task', parentId: 'g2', plannedStart: d(20), plannedEnd: d(25),  progress: 62, color: '#e05252' },
  { id: 't15', name: 'Task 15', type: 'task', parentId: 'g2', plannedStart: d(20), plannedEnd: d(32),  progress: 85, color: '#e05252' },
  { id: 't16', name: 'Task 16', type: 'task', parentId: 'g2', plannedStart: d(20), plannedEnd: d(36),  progress: 47, color: '#e05252' },
  { id: 't17', name: 'Task 17', type: 'task', parentId: 'g2', plannedStart: d(20), plannedEnd: d(39),  progress: 92, color: '#e05252' },
  { id: 't18', name: 'Task 18', type: 'task', parentId: 'g2', plannedStart: d(20), plannedEnd: d(44),  progress: 93, color: '#e05252' },
  { id: 'g3', name: 'Group 3', type: 'group', parentId: null, plannedStart: d(50), plannedEnd: d(150), progress: 10, color: '#4f46e5', collapsed: false },
  { id: 't19', name: 'Task 19', type: 'task', parentId: 'g3', plannedStart: d(50),  plannedEnd: d(70),  progress: 30, color: '#e05252', actualStart: d(52), actualEnd: d(68) },
  { id: 't20', name: 'Task 20', type: 'task', parentId: 'g3', plannedStart: d(55),  plannedEnd: d(80),  progress: 15, color: '#e05252', actualStart: d(57) },
  { id: 't21', name: 'Task 21', type: 'task', parentId: 'g3', plannedStart: d(65),  plannedEnd: d(90),  progress: 5,  color: '#e05252' },
  { id: 't22', name: 'Task 22', type: 'task', parentId: 'g3', plannedStart: d(80),  plannedEnd: d(110), progress: 0,  color: '#e05252' },
  { id: 't23', name: 'Task 23', type: 'task', parentId: 'g3', plannedStart: d(100), plannedEnd: d(130), progress: 0,  color: '#e05252' },
  { id: 'm2',  name: 'Milestone 2', type: 'milestone', parentId: 'g3', plannedStart: d(150), plannedEnd: d(150), progress: 0, color: '#f59e0b' },
];

export const mockDependencies: Dependency[] = [
  { id: 'd1',  fromId: 't1',  toId: 't3',  type: 'FS', offsetDays: 0 },
  { id: 'd2',  fromId: 't2',  toId: 't4',  type: 'FS', offsetDays: 2 },
  { id: 'd3',  fromId: 't3',  toId: 'm1',  type: 'FS', offsetDays: 0 },
  { id: 'd4',  fromId: 't6',  toId: 't7',  type: 'SS', offsetDays: 0 },
  { id: 'd5',  fromId: 't7',  toId: 't8',  type: 'FS', offsetDays: 1 },
  { id: 'd6',  fromId: 't19', toId: 't20', type: 'FS', offsetDays: 0 },
  { id: 'd7',  fromId: 't20', toId: 't21', type: 'FS', offsetDays: 0 },
  { id: 'd8',  fromId: 't21', toId: 't22', type: 'FS', offsetDays: 0 },
  { id: 'd9',  fromId: 't22', toId: 't23', type: 'FS', offsetDays: 0 },
  { id: 'd10', fromId: 't23', toId: 'm2',  type: 'FS', offsetDays: 0 },
  { id: 'd11', fromId: 't4',  toId: 't5',  type: 'SS', offsetDays: 5 },
  { id: 'd12', fromId: 't9',  toId: 't12', type: 'FF', offsetDays: 0 },
  { id: 'd13', fromId: 't10', toId: 't13', type: 'SF', offsetDays: 0 },
];

export const mockResources: ResourceAllocation[] = [
  { id: 'r1', taskId: 't1', resourceName: 'Resource 1', startDate: d(0),  endDate: d(14), hours: 120, departments: [], distribution: 'B0'   },
  { id: 'r2', taskId: 't2', resourceName: 'Resource 2', startDate: d(5),  endDate: d(20), hours: 80,  departments: [], distribution: 'B-1'  },
  { id: 'r3', taskId: 't6', resourceName: 'Resource 2', startDate: d(15), endDate: d(25), hours: 140, departments: [], distribution: 'B+1'  },
  { id: 'r4', taskId: 't8', resourceName: 'Resource 1', startDate: d(20), endDate: d(35), hours: 200, departments: [], distribution: 'flat' },
  { id: 'r5', taskId: 't19', resourceName: 'Resource 3', startDate: d(50), endDate: d(70), hours: 160, departments: [], distribution: 'B+2' },
  { id: 'r6', taskId: 't20', resourceName: 'Resource 1', startDate: d(55), endDate: d(80), hours: 180, departments: [], distribution: 'B-2' },
];

// ─── 3k task generator ────────────────────────────────────────────────────
const DEP_TYPES: DependencyType[] = ['FS', 'SS', 'FF', 'SF'];
const DIST_CURVES: DistributionCurve[] = ['B-2', 'B-1', 'B0', 'B+1', 'B+2', 'flat'];
const TASK_COLORS = ['#e05252', '#e06060', '#c84b4b', '#d95555', '#f06060'];
const RESOURCE_NAMES = ['Resource A', 'Resource B', 'Resource C', 'Resource D', 'Resource E'];

function rng(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

export function generate3kData(): { tasks: GanttTask[]; dependencies: Dependency[]; resources: ResourceAllocation[] } {
  const rand = rng(42);
  const tasks: GanttTask[] = [];
  const dependencies: Dependency[] = [];
  const resources: ResourceAllocation[] = [];

  const GROUP_COUNT = 50;
  const TASKS_PER_GROUP = 60; // 50 groups × 60 tasks = 3000

  let depIdx = 0;
  let resIdx = 0;

  for (let g = 0; g < GROUP_COUNT; g++) {
    const groupOffset = g * 6; // groups spread 6 days apart to create realistic overlap
    const groupId = `lg${g}`;

    const groupTaskIds: string[] = [];

    for (let t = 0; t < TASKS_PER_GROUP; t++) {
      const taskId = `lt${g * TASKS_PER_GROUP + t}`;
      const dur = 3 + Math.floor(rand() * 18);
      const taskOffset = groupOffset + Math.floor(rand() * 20);
      const taskStart = d(taskOffset);

      const isMilestone = t === TASKS_PER_GROUP - 1; // last task in group is milestone

      tasks.push({
        id: taskId,
        name: isMilestone ? `M${g + 1}.${t + 1}` : `T${g + 1}.${t + 1}`,
        type: isMilestone ? 'milestone' : 'task',
        parentId: groupId,
        plannedStart: taskStart,
        plannedEnd: isMilestone ? taskStart : addDays(taskStart, dur),
        progress: Math.floor(rand() * 100),
        color: TASK_COLORS[Math.floor(rand() * TASK_COLORS.length)],
        actualStart: rand() > 0.6 ? d(taskOffset + Math.floor(rand() * 3)) : undefined,
      });

      groupTaskIds.push(taskId);

      // Dependency to previous task (70% chance)
      if (t > 0 && rand() > 0.3) {
        const prevId = groupTaskIds[t - 1];
        const depType = DEP_TYPES[Math.floor(rand() * DEP_TYPES.length)];
        dependencies.push({
          id: `ld${depIdx++}`,
          fromId: prevId,
          toId: taskId,
          type: depType,
          offsetDays: Math.floor(rand() * 3),
        });
      }

      // Skip-level dependency (15% chance)
      if (t > 2 && rand() > 0.85) {
        const skipId = groupTaskIds[t - 3];
        dependencies.push({
          id: `ld${depIdx++}`,
          fromId: skipId,
          toId: taskId,
          type: 'FS',
          offsetDays: 0,
        });
      }

      // Resource allocation (35% chance)
      if (rand() > 0.65) {
        const res = RESOURCE_NAMES[Math.floor(rand() * RESOURCE_NAMES.length)];
        resources.push({
          id: `lr${resIdx++}`,
          taskId,
          resourceName: res,
          startDate: taskStart,
          endDate: addDays(taskStart, dur),
          hours: 4 + Math.floor(rand() * 60),
          departments: [],
          distribution: DIST_CURVES[Math.floor(rand() * DIST_CURVES.length)],
        });
      }
    }

    // Group entry
    const childTasks = tasks.filter(t => t.parentId === groupId);
    const minStart = new Date(Math.min(...childTasks.map(t => t.plannedStart.getTime())));
    const maxEnd   = new Date(Math.max(...childTasks.map(t => t.plannedEnd.getTime())));

    tasks.push({
      id: groupId,
      name: `Group ${g + 1}`,
      type: 'group',
      parentId: null,
      plannedStart: minStart,
      plannedEnd: maxEnd,
      progress: Math.floor(rand() * 100),
      color: '#4f46e5',
      collapsed: false,
    });

    // Cross-group dependency every 5 groups
    if (g > 0 && g % 5 === 0) {
      const prevGroupLastTask = `lt${(g - 1) * TASKS_PER_GROUP + TASKS_PER_GROUP - 2}`;
      const thisGroupFirstTask = `lt${g * TASKS_PER_GROUP}`;
      dependencies.push({
        id: `ld${depIdx++}`,
        fromId: prevGroupLastTask,
        toId: thisGroupFirstTask,
        type: 'FS',
        offsetDays: 1,
      });
    }
  }

  return { tasks, dependencies, resources };
}

import type { GanttTask, Dependency, ResourceAllocation, DependencyType, DistributionCurve } from '../types';
import { addDays } from 'date-fns';

// BASE = Dec 1, 2025  →  today (Mar 30, 2026) ≈ d(119)
// Tasks started between d(0)–d(119) are past their start → rescheduling fires on behind-schedule ones
const BASE = new Date(2025, 11, 1);
function d(offset: number): Date { return addDays(BASE, offset); }

// ─── Demo dataset — "GanttRx Platform" software project ──────────────────────
export const mockTasks: GanttTask[] = [

  // ── Group 1: Planning & Discovery ─────────────────────────────────────────
  { id: 'g1', name: 'Planning & Discovery', type: 'group', parentId: null,
    plannedStart: d(0), plannedEnd: d(50), progress: 92, color: '#6366f1', collapsed: false },
  { id: 't1', name: 'Requirements Gathering', type: 'task', parentId: 'g1',
    plannedStart: d(0), plannedEnd: d(21), progress: 100, color: '#6366f1',
    actualStart: d(0), actualEnd: d(20), wbs: '1.1', location: 'HQ / Remote' },
  { id: 't2', name: 'Market Research', type: 'task', parentId: 'g1',
    plannedStart: d(5), plannedEnd: d(18), progress: 100, color: '#8b5cf6',
    actualStart: d(6), actualEnd: d(17), wbs: '1.2' },
  { id: 't3', name: 'Stakeholder Workshops', type: 'task', parentId: 'g1',
    plannedStart: d(15), plannedEnd: d(35), progress: 100, color: '#6366f1',
    actualStart: d(16), actualEnd: d(34), wbs: '1.3', location: 'Conference Room A' },
  { id: 't4', name: 'Project Charter', type: 'task', parentId: 'g1',
    plannedStart: d(30), plannedEnd: d(45), progress: 90, color: '#8b5cf6',
    wbs: '1.4', notes: 'Pending final sign-off from stakeholders' },
  { id: 'ms1', name: 'Planning Complete', type: 'milestone', parentId: 'g1',
    plannedStart: d(50), plannedEnd: d(50), progress: 0, color: '#f59e0b', wbs: '1.0' },

  // ── Group 2: Design & UX ───────────────────────────────────────────────────
  { id: 'g2', name: 'Design & UX', type: 'group', parentId: null,
    plannedStart: d(45), plannedEnd: d(125), progress: 45, color: '#ec4899', collapsed: false },
  { id: 't5', name: 'Wireframing', type: 'task', parentId: 'g2',
    plannedStart: d(45), plannedEnd: d(68), progress: 100, color: '#ec4899',
    actualStart: d(46), actualEnd: d(67), wbs: '2.1' },
  { id: 't6', name: 'Design System', type: 'task', parentId: 'g2',
    plannedStart: d(55), plannedEnd: d(88), progress: 55, color: '#db2777',
    wbs: '2.2', notes: 'Colors, typography and component library' },
  { id: 't7', name: 'Prototyping', type: 'task', parentId: 'g2',
    plannedStart: d(75), plannedEnd: d(100), progress: 25, color: '#ec4899',
    wbs: '2.3' },
  { id: 't8', name: 'Usability Testing', type: 'task', parentId: 'g2',
    plannedStart: d(95), plannedEnd: d(118), progress: 5, color: '#f472b6',
    wbs: '2.4', location: 'UX Lab' },
  { id: 'ms2', name: 'Design Approved', type: 'milestone', parentId: 'g2',
    plannedStart: d(125), plannedEnd: d(125), progress: 0, color: '#f59e0b', wbs: '2.0' },

  // ── Group 3: Backend Development ──────────────────────────────────────────
  { id: 'g3', name: 'Backend Development', type: 'group', parentId: null,
    plannedStart: d(50), plannedEnd: d(155), progress: 38, color: '#22c55e', collapsed: false },
  { id: 't9',  name: 'Database Schema', type: 'task', parentId: 'g3',
    plannedStart: d(50), plannedEnd: d(72), progress: 95, color: '#16a34a',
    actualStart: d(51), actualEnd: d(71), wbs: '3.1' },
  { id: 't10', name: 'API Architecture', type: 'task', parentId: 'g3',
    plannedStart: d(58), plannedEnd: d(90), progress: 65, color: '#22c55e',
    wbs: '3.2', notes: 'REST + GraphQL hybrid approach' },
  { id: 't11', name: 'Auth Service', type: 'task', parentId: 'g3',
    plannedStart: d(82), plannedEnd: d(112), progress: 30, color: '#4ade80',
    wbs: '3.3' },
  { id: 't12', name: 'Core APIs', type: 'task', parentId: 'g3',
    plannedStart: d(105), plannedEnd: d(145), progress: 8, color: '#22c55e',
    wbs: '3.4' },
  { id: 't13', name: 'Data Pipeline', type: 'task', parentId: 'g3',
    plannedStart: d(108), plannedEnd: d(148), progress: 4, color: '#16a34a',
    wbs: '3.5', notes: 'ETL pipeline for analytics' },
  { id: 'ms3', name: 'Backend Alpha', type: 'milestone', parentId: 'g3',
    plannedStart: d(155), plannedEnd: d(155), progress: 0, color: '#f59e0b', wbs: '3.0' },

  // ── Group 4: Frontend Development ─────────────────────────────────────────
  { id: 'g4', name: 'Frontend Development', type: 'group', parentId: null,
    plannedStart: d(62), plannedEnd: d(148), progress: 28, color: '#06b6d4', collapsed: false },
  { id: 't14', name: 'Component Library', type: 'task', parentId: 'g4',
    plannedStart: d(62), plannedEnd: d(92), progress: 60, color: '#0891b2',
    wbs: '4.1' },
  { id: 't15', name: 'Dashboard Views', type: 'task', parentId: 'g4',
    plannedStart: d(88), plannedEnd: d(118), progress: 18, color: '#06b6d4',
    wbs: '4.2' },
  { id: 't16', name: 'Forms & Validation', type: 'task', parentId: 'g4',
    plannedStart: d(102), plannedEnd: d(135), progress: 5, color: '#22d3ee',
    wbs: '4.3' },
  { id: 't17', name: 'State Management', type: 'task', parentId: 'g4',
    plannedStart: d(98), plannedEnd: d(128), progress: 12, color: '#06b6d4',
    wbs: '4.4', notes: 'Zustand + React Query integration' },
  { id: 'ms4', name: 'Frontend Alpha', type: 'milestone', parentId: 'g4',
    plannedStart: d(148), plannedEnd: d(148), progress: 0, color: '#f59e0b', wbs: '4.0' },

  // ── Group 5: Testing & QA ─────────────────────────────────────────────────
  { id: 'g5', name: 'Testing & QA', type: 'group', parentId: null,
    plannedStart: d(92), plannedEnd: d(195), progress: 10, color: '#f59e0b', collapsed: false },
  { id: 't18', name: 'Test Plan', type: 'task', parentId: 'g5',
    plannedStart: d(92), plannedEnd: d(108), progress: 40, color: '#d97706',
    wbs: '5.1' },
  { id: 't19', name: 'Unit Tests', type: 'task', parentId: 'g5',
    plannedStart: d(110), plannedEnd: d(142), progress: 0, color: '#f59e0b',
    wbs: '5.2' },
  { id: 't20', name: 'Integration Tests', type: 'task', parentId: 'g5',
    plannedStart: d(138), plannedEnd: d(168), progress: 0, color: '#fbbf24',
    wbs: '5.3' },
  { id: 't21', name: 'Performance Tests', type: 'task', parentId: 'g5',
    plannedStart: d(158), plannedEnd: d(178), progress: 0, color: '#f59e0b',
    wbs: '5.4' },
  { id: 't22', name: 'UAT', type: 'task', parentId: 'g5',
    plannedStart: d(168), plannedEnd: d(190), progress: 0, color: '#d97706',
    wbs: '5.5', location: 'Client Site' },
  { id: 'ms5', name: 'QA Complete', type: 'milestone', parentId: 'g5',
    plannedStart: d(195), plannedEnd: d(195), progress: 0, color: '#f59e0b', wbs: '5.0' },

  // ── Group 6: Deployment & Launch ──────────────────────────────────────────
  { id: 'g6', name: 'Deployment & Launch', type: 'group', parentId: null,
    plannedStart: d(52), plannedEnd: d(205), progress: 30, color: '#ef4444', collapsed: false },
  { id: 't23', name: 'CI/CD Setup', type: 'task', parentId: 'g6',
    plannedStart: d(52), plannedEnd: d(82), progress: 88, color: '#dc2626',
    actualStart: d(53), actualEnd: d(80), wbs: '6.1' },
  { id: 't24', name: 'Staging Environment', type: 'task', parentId: 'g6',
    plannedStart: d(115), plannedEnd: d(140), progress: 8, color: '#ef4444',
    wbs: '6.2' },
  { id: 't25', name: 'Load Testing', type: 'task', parentId: 'g6',
    plannedStart: d(162), plannedEnd: d(178), progress: 0, color: '#f87171',
    wbs: '6.3' },
  { id: 't26', name: 'Production Deploy', type: 'task', parentId: 'g6',
    plannedStart: d(185), plannedEnd: d(192), progress: 0, color: '#ef4444',
    wbs: '6.4', notes: 'Blue/green deployment strategy' },
  { id: 't27', name: 'Post-Deploy Monitoring', type: 'task', parentId: 'g6',
    plannedStart: d(192), plannedEnd: d(202), progress: 0, color: '#dc2626',
    wbs: '6.5' },
  { id: 'ms6', name: 'GO LIVE', type: 'milestone', parentId: 'g6',
    plannedStart: d(205), plannedEnd: d(205), progress: 0, color: '#22c55e', wbs: '6.0' },
];

export const mockDependencies: Dependency[] = [
  // Group 1 internal
  { id: 'd01', fromId: 't1',  toId: 't3',  type: 'FS', offsetDays: 0 },
  { id: 'd02', fromId: 't2',  toId: 't3',  type: 'SS', offsetDays: 5 },
  { id: 'd03', fromId: 't3',  toId: 't4',  type: 'FS', offsetDays: 0 },
  { id: 'd04', fromId: 't4',  toId: 'ms1', type: 'FS', offsetDays: 0 },

  // Group 2 internal
  { id: 'd05', fromId: 'ms1', toId: 't5',  type: 'FS', offsetDays: 0 },
  { id: 'd06', fromId: 't5',  toId: 't6',  type: 'SS', offsetDays: 10 },
  { id: 'd07', fromId: 't6',  toId: 't7',  type: 'FS', offsetDays: 0 },
  { id: 'd08', fromId: 't7',  toId: 't8',  type: 'FS', offsetDays: 0 },
  { id: 'd09', fromId: 't8',  toId: 'ms2', type: 'FS', offsetDays: 0 },

  // Group 3 internal
  { id: 'd10', fromId: 'ms1', toId: 't9',  type: 'FS', offsetDays: 0 },
  { id: 'd11', fromId: 't9',  toId: 't10', type: 'SS', offsetDays: 8 },
  { id: 'd12', fromId: 't9',  toId: 't11', type: 'FS', offsetDays: 10 },
  { id: 'd13', fromId: 't11', toId: 't12', type: 'FS', offsetDays: 0 },
  { id: 'd14', fromId: 't10', toId: 't12', type: 'SF', offsetDays: 0 },
  { id: 'd15', fromId: 't12', toId: 't13', type: 'SS', offsetDays: 3 },
  { id: 'd16', fromId: 't12', toId: 'ms3', type: 'FS', offsetDays: 0 },
  { id: 'd17', fromId: 't13', toId: 'ms3', type: 'FF', offsetDays: 0 },

  // Group 4 internal
  { id: 'd18', fromId: 'ms1', toId: 't14', type: 'FS', offsetDays: 12 },
  { id: 'd19', fromId: 't6',  toId: 't14', type: 'SS', offsetDays: 0 },
  { id: 'd20', fromId: 't14', toId: 't15', type: 'FS', offsetDays: 0 },
  { id: 'd21', fromId: 't14', toId: 't17', type: 'SS', offsetDays: 5 },
  { id: 'd22', fromId: 't15', toId: 't16', type: 'FS', offsetDays: 0 },
  { id: 'd23', fromId: 't17', toId: 't16', type: 'FF', offsetDays: 0 },
  { id: 'd24', fromId: 't16', toId: 'ms4', type: 'FS', offsetDays: 0 },

  // Group 5 internal
  { id: 'd25', fromId: 'ms3', toId: 't18', type: 'FS', offsetDays: 0 },
  { id: 'd26', fromId: 'ms4', toId: 't18', type: 'SS', offsetDays: 0 },
  { id: 'd27', fromId: 't18', toId: 't19', type: 'FS', offsetDays: 0 },
  { id: 'd28', fromId: 't19', toId: 't20', type: 'FS', offsetDays: 0 },
  { id: 'd29', fromId: 't20', toId: 't21', type: 'SS', offsetDays: 5 },
  { id: 'd30', fromId: 't21', toId: 't22', type: 'FS', offsetDays: 0 },
  { id: 'd31', fromId: 't22', toId: 'ms5', type: 'FS', offsetDays: 0 },

  // Group 6 + cross-group
  { id: 'd32', fromId: 'ms4', toId: 't24', type: 'FS', offsetDays: 0 },
  { id: 'd33', fromId: 'ms3', toId: 't24', type: 'SS', offsetDays: 0 },
  { id: 'd34', fromId: 't21', toId: 't25', type: 'FS', offsetDays: 0 },
  { id: 'd35', fromId: 't24', toId: 't25', type: 'FS', offsetDays: 10 },
  { id: 'd36', fromId: 'ms5', toId: 't26', type: 'FS', offsetDays: 0 },
  { id: 'd37', fromId: 't25', toId: 't26', type: 'FS', offsetDays: 0 },
  { id: 'd38', fromId: 't26', toId: 't27', type: 'FS', offsetDays: 0 },
  { id: 'd39', fromId: 't27', toId: 'ms6', type: 'FS', offsetDays: 0 },
];

export const mockResources: ResourceAllocation[] = [
  // Planning
  { id: 'r01', taskId: 't1', resourceName: 'Ana Silva',
    startDate: d(0), endDate: d(21), hours: 120,
    departments: [{ id: 'dep1', department: 'Product', craftId: 'PM' }], distribution: 'B0' },
  { id: 'r02', taskId: 't3', resourceName: 'Ana Silva',
    startDate: d(15), endDate: d(35), hours: 80,
    departments: [{ id: 'dep1', department: 'Product', craftId: 'PM' }], distribution: 'flat' },
  { id: 'r03', taskId: 't4', resourceName: 'Carlos Mendes',
    startDate: d(30), endDate: d(45), hours: 60,
    departments: [{ id: 'dep2', department: 'Management', craftId: 'DIR' }], distribution: 'B-1' },

  // Design
  { id: 'r04', taskId: 't5', resourceName: 'Julia Costa',
    startDate: d(45), endDate: d(68), hours: 160,
    departments: [{ id: 'dep3', department: 'Design', craftId: 'UXD' }], distribution: 'B-1' },
  { id: 'r05', taskId: 't6', resourceName: 'Julia Costa',
    startDate: d(55), endDate: d(88), hours: 200,
    departments: [{ id: 'dep3', department: 'Design', craftId: 'UXD' }], distribution: 'B0' },
  { id: 'r06', taskId: 't6', resourceName: 'Pedro Alves',
    startDate: d(55), endDate: d(88), hours: 120,
    departments: [{ id: 'dep3', department: 'Design', craftId: 'UXD' }], distribution: 'B+1' },
  { id: 'r07', taskId: 't7', resourceName: 'Pedro Alves',
    startDate: d(75), endDate: d(100), hours: 180,
    departments: [{ id: 'dep3', department: 'Design', craftId: 'UXD' }], distribution: 'B+1' },
  { id: 'r08', taskId: 't8', resourceName: 'Julia Costa',
    startDate: d(95), endDate: d(118), hours: 80,
    departments: [{ id: 'dep3', department: 'Design', craftId: 'UXD' }], distribution: 'flat' },

  // Backend
  { id: 'r09', taskId: 't9', resourceName: 'Rafael Lima',
    startDate: d(50), endDate: d(72), hours: 150,
    departments: [{ id: 'dep4', department: 'Engineering', craftId: 'BE' }], distribution: 'B-2' },
  { id: 'r10', taskId: 't10', resourceName: 'Rafael Lima',
    startDate: d(58), endDate: d(90), hours: 200,
    departments: [{ id: 'dep4', department: 'Engineering', craftId: 'BE' }], distribution: 'B0' },
  { id: 'r11', taskId: 't10', resourceName: 'Mariana Souza',
    startDate: d(58), endDate: d(90), hours: 180,
    departments: [{ id: 'dep4', department: 'Engineering', craftId: 'BE' }], distribution: 'B+1' },
  { id: 'r12', taskId: 't11', resourceName: 'Mariana Souza',
    startDate: d(82), endDate: d(112), hours: 220,
    departments: [{ id: 'dep4', department: 'Engineering', craftId: 'BE' }], distribution: 'B+2' },
  { id: 'r13', taskId: 't12', resourceName: 'Rafael Lima',
    startDate: d(105), endDate: d(145), hours: 300,
    departments: [{ id: 'dep4', department: 'Engineering', craftId: 'BE' }], distribution: 'B-1' },
  { id: 'r14', taskId: 't13', resourceName: 'Felipe Torres',
    startDate: d(108), endDate: d(148), hours: 260,
    departments: [{ id: 'dep4', department: 'Engineering', craftId: 'BE' }], distribution: 'B+2' },

  // Frontend
  { id: 'r15', taskId: 't14', resourceName: 'Camila Ferreira',
    startDate: d(62), endDate: d(92), hours: 220,
    departments: [{ id: 'dep5', department: 'Engineering', craftId: 'FE' }], distribution: 'B0' },
  { id: 'r16', taskId: 't15', resourceName: 'Camila Ferreira',
    startDate: d(88), endDate: d(118), hours: 200,
    departments: [{ id: 'dep5', department: 'Engineering', craftId: 'FE' }], distribution: 'B-1' },
  { id: 'r17', taskId: 't15', resourceName: 'Diego Rocha',
    startDate: d(88), endDate: d(118), hours: 180,
    departments: [{ id: 'dep5', department: 'Engineering', craftId: 'FE' }], distribution: 'B0' },
  { id: 'r18', taskId: 't16', resourceName: 'Diego Rocha',
    startDate: d(102), endDate: d(135), hours: 240,
    departments: [{ id: 'dep5', department: 'Engineering', craftId: 'FE' }], distribution: 'flat' },
  { id: 'r19', taskId: 't17', resourceName: 'Camila Ferreira',
    startDate: d(98), endDate: d(128), hours: 160,
    departments: [{ id: 'dep5', department: 'Engineering', craftId: 'FE' }], distribution: 'B+2' },

  // QA
  { id: 'r20', taskId: 't18', resourceName: 'Lucia Neves',
    startDate: d(92), endDate: d(108), hours: 80,
    departments: [{ id: 'dep6', department: 'QA', craftId: 'QA' }], distribution: 'B0' },
  { id: 'r21', taskId: 't19', resourceName: 'Lucia Neves',
    startDate: d(110), endDate: d(142), hours: 200,
    departments: [{ id: 'dep6', department: 'QA', craftId: 'QA' }], distribution: 'B-1' },
  { id: 'r22', taskId: 't20', resourceName: 'Lucia Neves',
    startDate: d(138), endDate: d(168), hours: 180,
    departments: [{ id: 'dep6', department: 'QA', craftId: 'QA' }], distribution: 'B0' },
  { id: 'r23', taskId: 't21', resourceName: 'Bruno Castro',
    startDate: d(158), endDate: d(178), hours: 120,
    departments: [{ id: 'dep6', department: 'QA', craftId: 'QA' }], distribution: 'B+1' },

  // DevOps
  { id: 'r24', taskId: 't23', resourceName: 'Thiago Barbosa',
    startDate: d(52), endDate: d(82), hours: 180,
    departments: [{ id: 'dep7', department: 'Infra', craftId: 'OPS' }], distribution: 'flat' },
  { id: 'r25', taskId: 't24', resourceName: 'Thiago Barbosa',
    startDate: d(115), endDate: d(140), hours: 160,
    departments: [{ id: 'dep7', department: 'Infra', craftId: 'OPS' }], distribution: 'B0' },
  { id: 'r26', taskId: 't24', resourceName: 'Mariana Souza',
    startDate: d(115), endDate: d(140), hours: 100,
    departments: [{ id: 'dep4', department: 'Engineering', craftId: 'BE' }], distribution: 'B-1' },
  { id: 'r27', taskId: 't25', resourceName: 'Thiago Barbosa',
    startDate: d(162), endDate: d(178), hours: 80,
    departments: [{ id: 'dep7', department: 'Infra', craftId: 'OPS' }], distribution: 'B-1' },
  { id: 'r28', taskId: 't25', resourceName: 'Lucia Neves',
    startDate: d(162), endDate: d(178), hours: 60,
    departments: [{ id: 'dep6', department: 'QA', craftId: 'QA' }], distribution: 'B0' },
];

// ─── 3k task generator ────────────────────────────────────────────────────────
const DEP_TYPES: DependencyType[] = ['FS', 'SS', 'FF', 'SF'];
const DIST_CURVES: DistributionCurve[] = ['B-2', 'B-1', 'B0', 'B+1', 'B+2', 'flat'];
const GROUP_COLORS = [
  '#6366f1','#ec4899','#22c55e','#06b6d4','#f59e0b',
  '#ef4444','#8b5cf6','#14b8a6','#f97316','#3b82f6',
];
const TASK_COLORS = ['#e05252','#6366f1','#22c55e','#06b6d4','#f59e0b','#ec4899','#8b5cf6','#f97316'];
const RESOURCE_NAMES = ['Ana Silva','Rafael Lima','Julia Costa','Camila Ferreira','Lucia Neves','Thiago Barbosa','Diego Rocha','Mariana Souza'];

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
  const TASKS_PER_GROUP = 60;

  let depIdx = 0;
  let resIdx = 0;

  for (let g = 0; g < GROUP_COUNT; g++) {
    const groupOffset = g * 6;
    const groupId = `lg${g}`;
    const groupColor = GROUP_COLORS[g % GROUP_COLORS.length];
    const groupTaskIds: string[] = [];

    for (let t = 0; t < TASKS_PER_GROUP; t++) {
      const taskId = `lt${g * TASKS_PER_GROUP + t}`;
      const dur = 3 + Math.floor(rand() * 18);
      const taskOffset = groupOffset + Math.floor(rand() * 20);
      const taskStart = addDays(BASE, taskOffset);
      const isMilestone = t === TASKS_PER_GROUP - 1;

      tasks.push({
        id: taskId,
        name: isMilestone ? `M${g + 1}.${t + 1}` : `T${g + 1}.${t + 1}`,
        type: isMilestone ? 'milestone' : 'task',
        parentId: groupId,
        plannedStart: taskStart,
        plannedEnd: isMilestone ? taskStart : addDays(taskStart, dur),
        progress: Math.floor(rand() * 100),
        color: isMilestone ? '#f59e0b' : TASK_COLORS[Math.floor(rand() * TASK_COLORS.length)],
        actualStart: rand() > 0.6 ? addDays(BASE, taskOffset + Math.floor(rand() * 3)) : undefined,
      });

      groupTaskIds.push(taskId);

      if (t > 0 && rand() > 0.3) {
        dependencies.push({
          id: `ld${depIdx++}`,
          fromId: groupTaskIds[t - 1],
          toId: taskId,
          type: DEP_TYPES[Math.floor(rand() * DEP_TYPES.length)],
          offsetDays: Math.floor(rand() * 3),
        });
      }

      if (t > 2 && rand() > 0.85) {
        dependencies.push({
          id: `ld${depIdx++}`,
          fromId: groupTaskIds[t - 3],
          toId: taskId,
          type: 'FS',
          offsetDays: 0,
        });
      }

      if (rand() > 0.65) {
        resources.push({
          id: `lr${resIdx++}`,
          taskId,
          resourceName: RESOURCE_NAMES[Math.floor(rand() * RESOURCE_NAMES.length)],
          startDate: taskStart,
          endDate: addDays(taskStart, dur),
          hours: 4 + Math.floor(rand() * 60),
          departments: [],
          distribution: DIST_CURVES[Math.floor(rand() * DIST_CURVES.length)],
        });
      }
    }

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
      color: groupColor,
      collapsed: false,
    });

    if (g > 0 && g % 5 === 0) {
      dependencies.push({
        id: `ld${depIdx++}`,
        fromId: `lt${(g - 1) * TASKS_PER_GROUP + TASKS_PER_GROUP - 2}`,
        toId: `lt${g * TASKS_PER_GROUP}`,
        type: 'FS',
        offsetDays: 1,
      });
    }
  }

  return { tasks, dependencies, resources };
}

export type TaskType = 'task' | 'milestone' | 'group';
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export type DistributionCurve = 'B-2' | 'B-1' | 'B0' | 'B+1' | 'B+2' | 'flat';

export interface GanttTask {
  id: string;
  name: string;
  type: TaskType;
  parentId: string | null;
  color?: string;
  plannedStart: Date;
  plannedEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  progress: number;
  collapsed?: boolean;
  isCritical?: boolean;
  location?: string;
  notes?: string;
  wbs?: string;
}

export interface Dependency {
  id: string;
  fromId: string;
  toId: string;
  type: DependencyType;
  offsetDays: number;
}

export interface Department {
  id: string;
  department: string;
  craftId: string;
}

export interface ResourceAllocation {
  id: string;
  taskId: string;
  resourceName: string;
  startDate: Date;
  endDate: Date;
  hours: number;
  departments: Department[];
  distribution: DistributionCurve;
}

export interface DailyBucket {
  date: Date;
  byResource: Record<string, number>;
  total: number;
}

export interface GanttMarker {
  id: string;
  date: Date;
  label: string;
  color: string;
}

export type TaskListColumn = 'start' | 'end' | 'duration' | 'progress' | 'location' | 'notes' | 'wbs';

export interface GanttSettings {
  rowHeight: number;
  columnWidth: number;
  zoomFactor: number;
  showHistogram: boolean;
  showDependencies: boolean;
  showBaseline: boolean;
  showCriticalPath: boolean;
  autoSchedule: boolean;
  histogramHeight: number;
  taskListWidth: number;
  theme: 'dark' | 'light';
  showGrid: boolean;
  showActualBars: boolean;
  visibleColumns: TaskListColumn[];
}

export interface TaskLayout {
  taskId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  progressWidth: number;
}

export interface ReschedulingSuggestion {
  taskId: string;
  taskName: string;
  currentEnd: Date;
  suggestedEnd: Date;
  delayDays: number;
  reason: string;
}

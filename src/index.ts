// ─── GanttRx — Public API ────────────────────────────────────────────────────
import './index.css';

export { GanttChart } from './components/GanttChart/GanttChart';
export type { GanttChartProps } from './components/GanttChart/GanttChart';

// Types
export type {
  GanttTask,
  Dependency,
  ResourceAllocation,
  Department,
  GanttMarker,
  GanttSettings,
  DailyBucket,
  TaskLayout,
  ReschedulingSuggestion,
  TaskType,
  DependencyType,
  DistributionCurve,
  TaskListColumn,
} from './types';

// Event system
export type {
  GanttChangeEvent,
  GanttEventType,
  GanttSnapshot,
  TaskAddPayload,
  TaskUpdatePayload,
  TaskDeletePayload,
  TaskMovePayload,
  TaskResizePayload,
  TaskProgressPayload,
  DepAddPayload,
  DepUpdatePayload,
  DepRemovePayload,
  ResourceAddPayload,
  ResourceUpdatePayload,
  ResourceRemovePayload,
  MarkerAddPayload,
  MarkerUpdatePayload,
  MarkerRemovePayload,
  SettingsChangePayload,
  SelectionChangePayload,
} from './types/events';

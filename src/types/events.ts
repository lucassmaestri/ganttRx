import type { GanttTask, Dependency, ResourceAllocation, GanttMarker, GanttSettings } from './index';

// ─── Event type catalogue ────────────────────────────────────────────────────
export type GanttEventType =
  | 'task.add'
  | 'task.update'
  | 'task.delete'
  | 'task.move'        // plannedStart/plannedEnd changed (drag or cascade)
  | 'task.resize'      // one edge changed
  | 'task.progress'    // only progress changed
  | 'dependency.add'
  | 'dependency.update'
  | 'dependency.remove'
  | 'resource.add'
  | 'resource.update'
  | 'resource.remove'
  | 'marker.add'
  | 'marker.update'
  | 'marker.remove'
  | 'settings.change'
  | 'selection.change';

export interface GanttSnapshot {
  tasks: GanttTask[];
  dependencies: Dependency[];
  resources: ResourceAllocation[];
  markers: GanttMarker[];
  settings: GanttSettings;
}

// Payload shapes per event type
export interface TaskAddPayload       { task: GanttTask }
export interface TaskUpdatePayload    { task: GanttTask; previous: GanttTask }
export interface TaskDeletePayload    { taskId: string; task: GanttTask }
export interface TaskMovePayload      { moved: GanttTask[]; previous: GanttTask[] }   // may include cascade-moved tasks
export interface TaskResizePayload    { task: GanttTask; previous: GanttTask; edge: 'start' | 'end' }
export interface TaskProgressPayload  { task: GanttTask; previous: GanttTask }
export interface DepAddPayload        { dependency: Dependency }
export interface DepUpdatePayload     { dependency: Dependency; previous: Dependency }
export interface DepRemovePayload     { dependencyId: string; dependency: Dependency }
export interface ResourceAddPayload   { resource: ResourceAllocation }
export interface ResourceUpdatePayload{ resource: ResourceAllocation; previous: ResourceAllocation }
export interface ResourceRemovePayload{ resourceId: string; resource: ResourceAllocation }
export interface MarkerAddPayload     { marker: GanttMarker }
export interface MarkerUpdatePayload  { marker: GanttMarker; previous: GanttMarker }
export interface MarkerRemovePayload  { markerId: string; marker: GanttMarker }
export interface SettingsChangePayload{ settings: GanttSettings; previous: GanttSettings }
export interface SelectionChangePayload { selectedIds: string[]; activeTaskId: string | null }

export type GanttEventPayloadMap = {
  'task.add':           TaskAddPayload;
  'task.update':        TaskUpdatePayload;
  'task.delete':        TaskDeletePayload;
  'task.move':          TaskMovePayload;
  'task.resize':        TaskResizePayload;
  'task.progress':      TaskProgressPayload;
  'dependency.add':     DepAddPayload;
  'dependency.update':  DepUpdatePayload;
  'dependency.remove':  DepRemovePayload;
  'resource.add':       ResourceAddPayload;
  'resource.update':    ResourceUpdatePayload;
  'resource.remove':    ResourceRemovePayload;
  'marker.add':         MarkerAddPayload;
  'marker.update':      MarkerUpdatePayload;
  'marker.remove':      MarkerRemovePayload;
  'settings.change':    SettingsChangePayload;
  'selection.change':   SelectionChangePayload;
};

export interface GanttChangeEvent<T extends GanttEventType = GanttEventType> {
  type: T;
  payload: GanttEventPayloadMap[T];
  snapshot: GanttSnapshot;   // full state after the change
  timestamp: number;
}

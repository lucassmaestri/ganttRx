import type { GanttTask, GanttSettings, TaskLayout } from '../types';
import { dateToPixel } from './dateUtils';

export function computeLayout(
  tasks: GanttTask[],
  settings: GanttSettings,
  viewStart: Date,
  startIndex: number,
  endIndex: number
): Map<string, TaskLayout> {
  const map = new Map<string, TaskLayout>();
  const colW = settings.columnWidth * settings.zoomFactor;
  const rowH = settings.rowHeight;

  for (let i = startIndex; i <= Math.min(endIndex, tasks.length - 1); i++) {
    const task = tasks[i];
    const x = dateToPixel(task.plannedStart, viewStart, colW);
    const endX = dateToPixel(task.plannedEnd, viewStart, colW) + colW;
    const width = Math.max(endX - x, colW);
    const y = i * rowH;
    const progressWidth = (task.progress / 100) * width;

    map.set(task.id, { taskId: task.id, x, y, width, height: rowH - 2, progressWidth });
  }

  return map;
}

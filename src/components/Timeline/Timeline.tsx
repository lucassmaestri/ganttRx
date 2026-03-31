import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { GanttTask, TaskLayout, DependencyType } from '../../types';
import { useGanttStore } from '../../store/ganttStore';
import { useViewStore } from '../../store/viewStore';
import { useSelectionStore } from '../../store/selectionStore';
import { dateToPixel, isWeekend } from '../../lib/dateUtils';
import { computeLayout } from '../../lib/layoutEngine';
import { format, addMonths, startOfMonth, differenceInCalendarDays, addYears, startOfYear, addQuarters, startOfQuarter, subMonths } from 'date-fns';
import { VIEW_START, VIEW_END } from '../../lib/constants';
import { useLang } from '../../i18n';
export { VIEW_START, VIEW_END };

const C = {
  bg:              '#0f0f18',
  gridLine:        'rgba(255,255,255,0.025)',
  rowLine:         'rgba(255,255,255,0.02)',
  weekend:         'rgba(255,255,255,0.018)',
  barDefault:      '#e05252',
  barCritical:     '#ff3b3b',
  barGroup:        '#4f46e5',
  milestone:       '#f59e0b',
  progressOverlay: 'rgba(255,255,255,0.22)',
  todayLine:       '#a855f7',
  marker:          '#fbbf24',
  depLine:         'rgba(168,85,247,0.55)',
  depArrow:        'rgba(168,85,247,0.7)',
  depHighlight:    'rgba(255,255,255,0.75)',
  actualBar:       '#22c55e',
  text:            '#e2e2f0',
  criticalBorder:  '#ff3b3b',
  selectedOverlay: 'rgba(255,255,255,0.22)',
  selectedStroke:  'rgba(255,255,255,0.95)',
  connectedOverlay:'rgba(255,255,255,0.10)',
  connectedStroke: 'rgba(255,255,255,0.40)',
  endpointDot:     'rgba(255,255,255,0.7)',
  endpointHover:   '#a855f7',
  pendingDep:      '#a855f7',
} as const;

const HEADER_H    = 52;
const ACTUAL_BAR_H = 5;
const ACTUAL_BAR_GAP = 2;

type ScaleLevel = 'years' | 'year-quarter' | 'quarter-month' | 'month-day';

function getScale(colW: number): ScaleLevel {
  if (colW < 1.5) return 'years';
  if (colW < 4)   return 'year-quarter';
  if (colW < 9)   return 'quarter-month';
  return 'month-day';
}

function getDepType(fromSide: 'start'|'end', toSide: 'start'|'end'): DependencyType {
  if (fromSide === 'end'   && toSide === 'start') return 'FS';
  if (fromSide === 'start' && toSide === 'start') return 'SS';
  if (fromSide === 'end'   && toSide === 'end')   return 'FF';
  return 'SF';
}

interface HitZone {
  taskId: string;
  zone: 'move' | 'resize-start' | 'resize-end' | 'actual-move' | 'actual-start' | 'actual-end';
}

interface Endpoint { taskId: string; side: 'start' | 'end' }

interface TimelineProps { tasks: GanttTask[] }

export const Timeline: React.FC<TimelineProps> = ({ tasks }) => {
  const { t } = useLang();
  const settings     = useGanttStore(s => s.settings);
  const dependencies = useGanttStore(s => s.dependencies);
  const markers      = useGanttStore(s => s.markers);
  const moveTask     = useGanttStore(s => s.moveTask);
  const resizeTask   = useGanttStore(s => s.resizeTask);
  const moveActual   = useGanttStore(s => s.moveActual);
  const addDependency = useGanttStore(s => s.addDependency);
  const { scrollLeft, setScrollLeft, scrollTop, setScrollTop } = useViewStore();
  const { selectedIds, clearSelection, selectOnly, openPanel } = useSelectionStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef      = useRef<HTMLCanvasElement>(null);
  const barsRef      = useRef<HTMLCanvasElement>(null);
  const depsRef      = useRef<HTMLCanvasElement>(null);
  const overlayRef   = useRef<HTMLCanvasElement>(null);
  const connectRef   = useRef<HTMLCanvasElement>(null);

  const colW      = settings.columnWidth * settings.zoomFactor;
  const rowH      = settings.rowHeight;
  const totalDays = differenceInCalendarDays(VIEW_END, VIEW_START) + 1;
  const today     = new Date();
  const scale     = getScale(colW);

  // ─── O(1) task lookup — avoids iterating 3k array inside drawBars ──────────
  const taskById = React.useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  // ─── Ctrl-mode state (using refs for performance) ─────────────────────────
  const ctrlHeldRef   = useRef(false);
  const [ctrlHeld, setCtrlHeld]       = useState(false);
  const pendingDepRef = useRef<Endpoint | null>(null);
  const [pendingDep, setPendingDep]   = useState<Endpoint | null>(null);
  const mouseCanvasPosRef = useRef<{ x: number; y: number } | null>(null);
  const hoverEndpointRef  = useRef<Endpoint | null>(null);
  const connectRafRef = useRef(0);

  // ─── Drag state ────────────────────────────────────────────────────────────
  const dragRef = useRef<{
    zone: HitZone['zone'];
    taskId: string;
    startClientX: number;
    origStart: Date;
    origEnd: Date;
    origActualStart?: Date;
    origActualEnd?: Date;
    lastDayDelta: number;
  } | null>(null);
  const panRef = useRef<{ startX: number; startLeft: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Visual-only drag for large datasets (>500 tasks) — committed on pointerUp
  const pendingVisualRef = useRef<{ taskId: string; zone: HitZone['zone']; dayDelta: number } | null>(null);

  // ─── Scroll to 1 month before earliest task on first load ─────────────────
  const didInitScroll = useRef(false);
  useEffect(() => {
    if (didInitScroll.current || tasks.length === 0) return;
    didInitScroll.current = true;
    const earliest = tasks.reduce((min, t) =>
      t.plannedStart < min ? t.plannedStart : min, tasks[0].plannedStart);
    const target = subMonths(earliest, 1);
    const px = Math.max(0, (target.getTime() - VIEW_START.getTime()) / 86400000 * colW);
    setScrollLeft(px);
  }, [tasks, colW, setScrollLeft]);

  // ─── Ctrl key listeners ────────────────────────────────────────────────────
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.key === 'Control') { ctrlHeldRef.current = true; setCtrlHeld(true); }
      if (e.key === 'Escape')  { pendingDepRef.current = null; setPendingDep(null); scheduleConnectRedraw(); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        ctrlHeldRef.current = false; setCtrlHeld(false);
        pendingDepRef.current = null; setPendingDep(null);
        scheduleConnectRedraw();
      }
    };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, []);

  // ─── Layout helper ─────────────────────────────────────────────────────────
  const getLayout = useCallback((h: number): Map<string, TaskLayout> => {
    const si = Math.floor(scrollTop / rowH);
    const ei = Math.ceil((scrollTop + h) / rowH);
    return computeLayout(tasks, settings, VIEW_START, si, ei);
  }, [tasks, settings, scrollTop, rowH]);

  // ─── Connected task IDs — memoized, not recomputed per draw frame ─────────
  const connectedIds = React.useMemo(() => {
    const connected = new Set<string>();
    for (const dep of dependencies) {
      if (selectedIds.has(dep.fromId)) connected.add(dep.toId);
      if (selectedIds.has(dep.toId))   connected.add(dep.fromId);
    }
    return connected;
  }, [dependencies, selectedIds]);

  // ─── Draw grid ─────────────────────────────────────────────────────────────
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    if (!settings.showGrid) return;
    const first = Math.floor(scrollLeft / colW);
    const last  = Math.ceil((scrollLeft + w) / colW);
    // Weekend backgrounds (fill-only, no stroke)
    for (let i = first; i <= last; i++) {
      const x = i * colW - scrollLeft;
      const dd = new Date(VIEW_START); dd.setDate(VIEW_START.getDate() + i);
      if (isWeekend(dd)) { ctx.fillStyle = C.weekend; ctx.fillRect(x, 0, colW, h); }
    }
    // Batch vertical lines into a single path
    ctx.strokeStyle = C.gridLine; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = first; i <= last; i++) {
      const x = Math.round(i * colW - scrollLeft) + 0.5;
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
    }
    ctx.stroke();
    // Batch horizontal row lines
    const firstRow = Math.floor(scrollTop / rowH);
    const lastRow  = Math.ceil((scrollTop + h) / rowH);
    ctx.strokeStyle = C.rowLine;
    ctx.beginPath();
    for (let i = firstRow; i <= lastRow; i++) {
      const y = Math.round(i * rowH - scrollTop) + 0.5;
      ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    ctx.stroke();
  }, [scrollLeft, scrollTop, colW, rowH, settings.showGrid]);

  // ─── Draw bars ─────────────────────────────────────────────────────────────
  const drawBars = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, layout: Map<string, TaskLayout>) => {
    ctx.clearRect(0, 0, w, h);
    const connected  = connectedIds;
    const barTopOff  = 3;
    const barH       = rowH - 10;
    const actualY    = rowH - ACTUAL_BAR_H - ACTUAL_BAR_GAP;

    for (const [, lyt] of layout) {
      const task = taskById.get(lyt.taskId);
      if (!task) continue;
      const bx = lyt.x - scrollLeft;
      const by = lyt.y - scrollTop;
      const bw = lyt.width;
      if (by + rowH < 0 || by > h) continue;
      if (bx + bw < -10 || bx > w + 10) continue;

      const isSelected  = selectedIds.has(task.id);
      const isConnected = !isSelected && connected.has(task.id);
      const isCritical  = !!(task.isCritical && settings.showCriticalPath);
      const barColor    = isCritical ? C.barCritical : (task.color ?? C.barDefault);

      // Apply pending visual offset for large-dataset drag
      const pv = pendingVisualRef.current;
      if (pv && pv.taskId === task.id) {
        const pxD = pv.dayDelta * colW;
        if (pv.zone === 'move')         { lyt.x += pxD; }
        else if (pv.zone === 'resize-start') { lyt.x += pxD; lyt.width -= pxD; }
        else if (pv.zone === 'resize-end')   { lyt.width += pxD; }
      }

      // ── Milestone ──
      if (task.type === 'milestone') {
        const cx = bx + colW / 2;
        const cy = by + rowH / 2;
        const sz = Math.min(rowH * 0.38, 9);
        ctx.beginPath();
        ctx.moveTo(cx, cy - sz); ctx.lineTo(cx + sz, cy);
        ctx.lineTo(cx, cy + sz); ctx.lineTo(cx - sz, cy);
        ctx.closePath();
        ctx.fillStyle = task.color ?? C.milestone;
        ctx.fill();
        if (isSelected) {
          ctx.fillStyle = C.selectedOverlay; ctx.fill();
          ctx.strokeStyle = C.selectedStroke; ctx.lineWidth = 2; ctx.stroke();
        } else if (isConnected) {
          ctx.fillStyle = C.connectedOverlay; ctx.fill();
          ctx.strokeStyle = C.connectedStroke; ctx.lineWidth = 1.5; ctx.stroke();
        } else if (isCritical) {
          ctx.strokeStyle = C.criticalBorder; ctx.lineWidth = 2; ctx.stroke();
        }
        ctx.fillStyle = C.text;
        ctx.font = `bold 10px Inter,system-ui`;
        ctx.fillText(task.name, cx + sz + 4, cy + 4);
        continue;
      }

      // ── Group ──
      if (task.type === 'group') {
        const gh = 7; const gy = by + (rowH - gh) / 2;
        ctx.fillStyle = task.color ?? C.barGroup;
        ctx.globalAlpha = isSelected ? 1 : 0.75;
        ctx.fillRect(bx, gy, bw, gh);
        ctx.fillRect(bx, gy - 3, 5, gh + 6);
        ctx.fillRect(bx + bw - 5, gy - 3, 5, gh + 6);
        ctx.globalAlpha = 1;
        if (isSelected) {
          ctx.strokeStyle = C.selectedStroke; ctx.lineWidth = 2;
          ctx.strokeRect(bx - 1, gy - 4, bw + 2, gh + 8);
        }
        if (bw > 30) {
          ctx.save(); ctx.beginPath(); ctx.rect(bx + 6, by, bw - 12, rowH); ctx.clip();
          ctx.fillStyle = C.text; ctx.font = `bold 10px Inter,system-ui`;
          ctx.fillText(task.name, bx + 7, by + rowH / 2 + 4); ctx.restore();
        }
        continue;
      }

      // ── Regular task ──
      const r  = 3;
      const tx = bx, ty = by + barTopOff;
      const tw = Math.max(bw, 2), th = barH;

      ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, r);
      ctx.fillStyle = barColor; ctx.fill();

      if (task.progress > 0 && bw > 4) {
        const pw = Math.min(lyt.progressWidth, bw);
        ctx.save(); ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, r); ctx.clip();
        ctx.fillStyle = C.progressOverlay; ctx.fillRect(tx, ty, pw, th); ctx.restore();
      }

      if (isCritical) {
        ctx.strokeStyle = C.criticalBorder; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, r); ctx.stroke();
      }

      if (isSelected) {
        ctx.fillStyle = C.selectedOverlay;
        ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, r); ctx.fill();
        ctx.strokeStyle = C.selectedStroke; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(tx - 1, ty - 1, tw + 2, th + 2, r + 1); ctx.stroke();
      } else if (isConnected) {
        ctx.fillStyle = C.connectedOverlay;
        ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, r); ctx.fill();
        ctx.strokeStyle = C.connectedStroke; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, r); ctx.stroke();
      }

      if (bw > 20) {
        ctx.save(); ctx.beginPath(); ctx.rect(tx + 3, ty, tw - 6, th); ctx.clip();
        ctx.fillStyle = isSelected || isConnected ? '#fff' : '#fff';
        ctx.font = `10px Inter,system-ui`;
        ctx.fillText(task.name, tx + 4, ty + th / 2 + 3.5); ctx.restore();
      }

      // ── Actual bar ──
      if (settings.showActualBars && task.actualStart) {
        const aS = task.actualStart, aE = task.actualEnd ?? aS;
        const ax = dateToPixel(aS, VIEW_START, colW) - scrollLeft;
        const aw = Math.max(dateToPixel(aE, VIEW_START, colW) + colW - scrollLeft - ax, colW);
        const aY = by + actualY;
        ctx.fillStyle = C.actualBar; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.roundRect(ax, aY, aw, ACTUAL_BAR_H, 2); ctx.fill();
        ctx.globalAlpha = 0.7; ctx.fillStyle = '#fff';
        ctx.fillRect(ax, aY, 4, ACTUAL_BAR_H);
        ctx.fillRect(ax + aw - 4, aY, 4, ACTUAL_BAR_H);
        ctx.globalAlpha = 1;
      }
    }
  }, [taskById, scrollLeft, scrollTop, colW, rowH, selectedIds, connectedIds, settings.showCriticalPath, settings.showActualBars]);

  // ─── Draw dependencies ─────────────────────────────────────────────────────
  const drawDeps = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, layout: Map<string, TaskLayout>) => {
    ctx.clearRect(0, 0, w, h);
    if (!settings.showDependencies) return;

    for (const dep of dependencies) {
      // Skip if neither endpoint is in the visible row range
      const from = layout.get(dep.fromId);
      const to   = layout.get(dep.toId);
      if (!from && !to) continue;
      if (!from || !to) continue;

      const fy = from.y - scrollTop + from.height / 2;
      const ty = to.y   - scrollTop + to.height / 2;
      const isHighlighted = selectedIds.has(dep.fromId) || selectedIds.has(dep.toId);

      let fx: number, tx: number;
      switch (dep.type) {
        case 'FS': fx = from.x + from.width - scrollLeft; tx = to.x - scrollLeft; break;
        case 'SS': fx = from.x - scrollLeft; tx = to.x - scrollLeft - 8; break;
        case 'FF': fx = from.x + from.width - scrollLeft; tx = to.x + to.width - scrollLeft; break;
        case 'SF': fx = from.x - scrollLeft; tx = to.x + to.width - scrollLeft; break;
        default:   fx = from.x + from.width - scrollLeft; tx = to.x - scrollLeft;
      }

      ctx.strokeStyle = isHighlighted ? C.depHighlight : C.depLine;
      ctx.lineWidth   = isHighlighted ? 2 : 1.5;
      ctx.beginPath(); ctx.moveTo(fx, fy);
      if (dep.type === 'FS' || dep.type === 'SF') {
        ctx.lineTo(fx + 8, fy); ctx.lineTo(fx + 8, ty); ctx.lineTo(tx, ty);
      } else {
        const mx = (fx + tx) / 2;
        ctx.lineTo(mx, fy); ctx.lineTo(mx, ty); ctx.lineTo(tx, ty);
      }
      ctx.stroke();
      ctx.fillStyle = isHighlighted ? C.depHighlight : C.depArrow;
      ctx.beginPath();
      if (dep.type === 'FF' || dep.type === 'SF') {
        ctx.moveTo(tx + 6, ty - 3); ctx.lineTo(tx + 6, ty + 3); ctx.lineTo(tx, ty);
      } else {
        ctx.moveTo(tx - 6, ty - 3); ctx.lineTo(tx - 6, ty + 3); ctx.lineTo(tx, ty);
      }
      ctx.closePath(); ctx.fill();
    }
  }, [dependencies, scrollLeft, scrollTop, settings.showDependencies, selectedIds]);

  // ─── Draw overlay (today + markers) ────────────────────────────────────────
  const drawOverlay = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    for (const mk of markers) {
      const x = Math.round(dateToPixel(mk.date, VIEW_START, colW) - scrollLeft) + 0.5;
      if (x < -2 || x > w + 2) continue;
      ctx.strokeStyle = mk.color; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = mk.color;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 14, 0); ctx.lineTo(x + 14, 10); ctx.lineTo(x + 8, 14); ctx.lineTo(x, 14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = `bold 8px Inter,system-ui`; ctx.fillText(mk.label.slice(0, 4), x + 2, 10);
    }
    const todayX = Math.round(dateToPixel(today, VIEW_START, colW) - scrollLeft) + 0.5;
    if (todayX >= 0 && todayX <= w) {
      ctx.strokeStyle = C.todayLine; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
      ctx.beginPath(); ctx.moveTo(todayX, 0); ctx.lineTo(todayX, h); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.todayLine;
      ctx.beginPath(); ctx.moveTo(todayX - 5, 0); ctx.lineTo(todayX + 5, 0); ctx.lineTo(todayX, 7); ctx.closePath(); ctx.fill();
    }
  }, [scrollLeft, colW, markers, today]);

  // ─── Draw connect-mode overlay (Ctrl + dep creation) ──────────────────────
  const drawConnect = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, layout: Map<string, TaskLayout>) => {
    ctx.clearRect(0, 0, w, h);
    if (!ctrlHeldRef.current) return;

    const DOT_R = 5;
    const pending = pendingDepRef.current;
    const hover   = hoverEndpointRef.current;
    const mpos    = mouseCanvasPosRef.current;

    // Draw dots at visible endpoints only (iterate layout, not all 3k tasks)
    for (const [, lyt] of layout) {
      const task = taskById.get(lyt.taskId);
      if (!task || task.type === 'group') continue;

      const midY  = lyt.y - scrollTop + lyt.height / 2;
      const startX = lyt.x - scrollLeft;
      const endX   = lyt.x + lyt.width - scrollLeft;

      (['start', 'end'] as const).forEach(side => {
        const cx = side === 'start' ? startX : endX;
        const isPending = pending?.taskId === task.id && pending?.side === side;
        const isHover   = hover?.taskId   === task.id && hover?.side   === side;

        ctx.beginPath();
        ctx.arc(cx, midY, DOT_R, 0, Math.PI * 2);
        ctx.fillStyle = isPending ? '#fff' : isHover ? C.endpointHover : C.endpointDot;
        ctx.fill();
        if (isPending || isHover) {
          ctx.strokeStyle = isPending ? '#a855f7' : '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    }

    // Draw preview line from pending endpoint to mouse
    if (pending && mpos) {
      const fromLyt = layout.get(pending.taskId);
      if (fromLyt) {
        const fx = (pending.side === 'start' ? fromLyt.x : fromLyt.x + fromLyt.width) - scrollLeft;
        const fy = fromLyt.y - scrollTop + fromLyt.height / 2;
        ctx.strokeStyle = C.pendingDep; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(fx, fy);
        // Orthogonal projection: horizontal then vertical
        ctx.lineTo(mpos.x, fy);
        ctx.lineTo(mpos.x, mpos.y);
        ctx.stroke(); ctx.setLineDash([]);
        // Arrow tip
        ctx.fillStyle = C.pendingDep;
        ctx.beginPath(); ctx.arc(mpos.x, mpos.y, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }, [taskById, scrollLeft, scrollTop]);

  // ─── Schedule connect redraw (RAF, no React) ───────────────────────────────
  const scheduleConnectRedraw = useCallback(() => {
    cancelAnimationFrame(connectRafRef.current);
    connectRafRef.current = requestAnimationFrame(() => {
      const el = containerRef.current;
      if (!el) return;
      const w = el.clientWidth, h = el.clientHeight - HEADER_H;
      const canvas = connectRef.current;
      if (!canvas) return;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) drawConnect(ctx, w, h, getLayout(h));
    });
  }, [drawConnect, getLayout]);

  // ─── Master redraw — RAF-scheduled to coalesce rapid updates ─────────────
  const redrawRafRef = useRef(0);
  const redrawAll = useCallback(() => {
    cancelAnimationFrame(redrawRafRef.current);
    redrawRafRef.current = requestAnimationFrame(() => {
      const el = containerRef.current;
      if (!el) return;
      const w = el.clientWidth, h = el.clientHeight - HEADER_H;
      if (w <= 0 || h <= 0) return;
      const layout = getLayout(h);

      const setup = (ref: React.RefObject<HTMLCanvasElement | null>) => {
        const c = ref.current; if (!c) return null;
        if (c.width !== w) c.width = w;
        if (c.height !== h) c.height = h;
        return c.getContext('2d');
      };

      const gc = setup(gridRef), bc = setup(barsRef), dc = setup(depsRef), oc = setup(overlayRef);
      if (gc) drawGrid(gc, w, h);
      if (bc) drawBars(bc, w, h, layout);
      if (dc) drawDeps(dc, w, h, layout);
      if (oc) drawOverlay(oc, w, h);
      scheduleConnectRedraw();
    });
  }, [getLayout, drawGrid, drawBars, drawDeps, drawOverlay, scheduleConnectRedraw]);

  useEffect(() => { redrawAll(); }, [redrawAll]);

  // ─── Endpoint hit testing ──────────────────────────────────────────────────
  const hitEndpoint = useCallback((px: number, py: number): Endpoint | null => {
    const el = containerRef.current; if (!el) return null;
    const layout = getLayout(el.clientHeight - HEADER_H);
    const ax = px + scrollLeft, ay = py + scrollTop;
    const RADIUS = 14;
    for (const task of tasks) {
      if (task.type === 'group') continue;
      const lyt = layout.get(task.id); if (!lyt) continue;
      const midY = lyt.y + lyt.height / 2;
      if (Math.abs(ay - midY) > lyt.height / 2 + 4) continue;
      if (Math.abs(ax - lyt.x) < RADIUS) return { taskId: task.id, side: 'start' };
      if (Math.abs(ax - (lyt.x + lyt.width)) < RADIUS) return { taskId: task.id, side: 'end' };
    }
    return null;
  }, [tasks, getLayout, scrollLeft, scrollTop]);

  // ─── Normal hit testing ────────────────────────────────────────────────────
  const hitTest = useCallback((px: number, py: number): HitZone | null => {
    const el = containerRef.current; if (!el) return null;
    const layout = getLayout(el.clientHeight - HEADER_H);
    const ax = px + scrollLeft, ay = py + scrollTop;
    const HANDLE = 7;
    const actualY = rowH - ACTUAL_BAR_H - ACTUAL_BAR_GAP;

    for (const task of tasks) {
      const lyt = layout.get(task.id); if (!lyt) continue;
      if (ay < lyt.y || ay > lyt.y + rowH) continue;
      const localY = ay - lyt.y;
      // Actual bar zone
      if (task.actualStart && localY >= actualY && localY <= actualY + ACTUAL_BAR_H + 2) {
        const aS = task.actualStart, aE = task.actualEnd ?? aS;
        const ax0 = dateToPixel(aS, VIEW_START, colW), ax1 = dateToPixel(aE, VIEW_START, colW) + colW;
        if (ax >= ax0 - 4 && ax <= ax1 + 4) {
          if (ax <= ax0 + HANDLE) return { taskId: task.id, zone: 'actual-start' };
          if (ax >= ax1 - HANDLE) return { taskId: task.id, zone: 'actual-end' };
          return { taskId: task.id, zone: 'actual-move' };
        }
      }
      if (ax < lyt.x - 4 || ax > lyt.x + lyt.width + 4) continue;
      if (ax <= lyt.x + HANDLE) return { taskId: task.id, zone: 'resize-start' };
      if (ax >= lyt.x + lyt.width - HANDLE) return { taskId: task.id, zone: 'resize-end' };
      return { taskId: task.id, zone: 'move' };
    }
    return null;
  }, [tasks, getLayout, scrollLeft, scrollTop, rowH, colW]);

  // ─── Pointer handlers ──────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top - HEADER_H;
    if (py < 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    if (ctrlHeldRef.current) return; // handled in pointerUp for Ctrl mode

    const hit = hitTest(px, py);
    if (hit) {
      const task = tasks.find(t => t.id === hit.taskId);
      if (!task) return;
      dragRef.current = {
        zone: hit.zone, taskId: hit.taskId,
        startClientX: e.clientX,
        origStart: task.plannedStart, origEnd: task.plannedEnd,
        origActualStart: task.actualStart, origActualEnd: task.actualEnd,
        lastDayDelta: 0,
      };
      setDragging(true);
    } else {
      panRef.current = { startX: e.clientX, startLeft: scrollLeft };
    }
  }, [hitTest, tasks, scrollLeft]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const canvasPx = e.clientX - rect.left;
    const canvasPy = e.clientY - rect.top - HEADER_H;

    // Update mouse position and hover endpoint for connect canvas
    mouseCanvasPosRef.current = { x: canvasPx, y: canvasPy };
    if (ctrlHeldRef.current) {
      const ep = hitEndpoint(canvasPx, canvasPy);
      hoverEndpointRef.current = ep;
      scheduleConnectRedraw();
    }

    if (panRef.current) {
      const delta = panRef.current.startX - e.clientX;
      setScrollLeft(Math.max(0, panRef.current.startLeft + delta));
      return;
    }
    if (!dragRef.current) return;

    const rawDelta = e.clientX - dragRef.current.startClientX;
    const dayDelta = Math.round(rawDelta / colW);
    if (dayDelta === dragRef.current.lastDayDelta) return;
    dragRef.current.lastDayDelta = dayDelta;

    const { zone, taskId, origStart, origEnd, origActualStart, origActualEnd } = dragRef.current;

    // Large dataset: visual-only drag, commit on pointerUp
    if (tasks.length > 500) {
      pendingVisualRef.current = { taskId, zone, dayDelta };
      redrawAll();
      return;
    }

    if (zone === 'move') {
      const ns = new Date(origStart); ns.setDate(ns.getDate() + dayDelta); moveTask(taskId, ns);
    } else if (zone === 'resize-start') {
      const nd = new Date(origStart); nd.setDate(nd.getDate() + dayDelta); resizeTask(taskId, 'start', nd);
    } else if (zone === 'resize-end') {
      const nd = new Date(origEnd); nd.setDate(nd.getDate() + dayDelta); resizeTask(taskId, 'end', nd);
    } else if (zone === 'actual-move' && origActualStart) {
      const nd = new Date(origActualStart); nd.setDate(nd.getDate() + dayDelta); moveActual(taskId, 'move', nd);
    } else if (zone === 'actual-start' && origActualStart) {
      const nd = new Date(origActualStart); nd.setDate(nd.getDate() + dayDelta); moveActual(taskId, 'start', nd);
    } else if (zone === 'actual-end' && origActualEnd) {
      const nd = new Date(origActualEnd); nd.setDate(nd.getDate() + dayDelta); moveActual(taskId, 'end', nd);
    }
  }, [colW, moveTask, resizeTask, moveActual, setScrollLeft, hitEndpoint, scheduleConnectRedraw, tasks.length, redrawAll]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top - HEADER_H;

    if (ctrlHeldRef.current && py >= 0) {
      const ep = hitEndpoint(px, py);
      if (ep) {
        if (!pendingDepRef.current) {
          pendingDepRef.current = ep;
          setPendingDep(ep);
        } else if (pendingDepRef.current.taskId !== ep.taskId) {
          const type = getDepType(pendingDepRef.current.side, ep.side);
          addDependency({ id: `dep-${Date.now()}`, fromId: pendingDepRef.current.taskId, toId: ep.taskId, type, offsetDays: 0 });
          pendingDepRef.current = null;
          setPendingDep(null);
        } else {
          pendingDepRef.current = null; setPendingDep(null);
        }
        scheduleConnectRedraw();
      }
      dragRef.current = null; panRef.current = null;
      return;
    }

    if (dragRef.current) {
      if (Math.abs(e.clientX - dragRef.current.startClientX) < 4) {
        const tid = dragRef.current.taskId;
        if (selectedIds.has(tid)) clearSelection();
        else selectOnly(tid);
      } else if (pendingVisualRef.current) {
        // Commit the deferred move for large datasets
        const pv = pendingVisualRef.current;
        const { origStart, origEnd, origActualStart, origActualEnd } = dragRef.current;
        const dd = pv.dayDelta;
        if (pv.zone === 'move') {
          const ns = new Date(origStart); ns.setDate(ns.getDate() + dd); moveTask(pv.taskId, ns);
        } else if (pv.zone === 'resize-start') {
          const nd = new Date(origStart); nd.setDate(nd.getDate() + dd); resizeTask(pv.taskId, 'start', nd);
        } else if (pv.zone === 'resize-end') {
          const nd = new Date(origEnd); nd.setDate(nd.getDate() + dd); resizeTask(pv.taskId, 'end', nd);
        } else if (pv.zone === 'actual-move' && origActualStart) {
          const nd = new Date(origActualStart); nd.setDate(nd.getDate() + dd); moveActual(pv.taskId, 'move', nd);
        } else if (pv.zone === 'actual-start' && origActualStart) {
          const nd = new Date(origActualStart); nd.setDate(nd.getDate() + dd); moveActual(pv.taskId, 'start', nd);
        } else if (pv.zone === 'actual-end' && origActualEnd) {
          const nd = new Date(origActualEnd); nd.setDate(nd.getDate() + dd); moveActual(pv.taskId, 'end', nd);
        }
      }
    }
    pendingVisualRef.current = null;
    dragRef.current = null; panRef.current = null;
    setDragging(false);
  }, [hitEndpoint, addDependency, selectOnly, clearSelection, scheduleConnectRedraw, moveTask, resizeTask, moveActual, selectedIds]);

  const onDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (ctrlHeldRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top - HEADER_H);
    if (hit && hit.zone === 'move') openPanel(hit.taskId);
  }, [hitTest, openPanel]);

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.shiftKey) {
      setScrollTop(Math.max(0, scrollTop + e.deltaY));
    } else if (e.altKey) {
      setScrollLeft(Math.max(0, scrollLeft + e.deltaY * 2));
    } else {
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.max(0.03, Math.min(8, settings.zoomFactor * factor));
      const rect = e.currentTarget.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const dayAt = (cursorX + scrollLeft) / colW;
      const newColW = settings.columnWidth * newZoom;
      useGanttStore.getState().setSettings({ zoomFactor: newZoom });
      setScrollLeft(Math.max(0, dayAt * newColW - cursorX));
    }
  }, [settings.zoomFactor, settings.columnWidth, colW, scrollLeft, scrollTop, setScrollLeft, setScrollTop]);

  // ─── Header generation ─────────────────────────────────────────────────────
  const cw = containerRef.current?.clientWidth ?? 2000;

  function makeRow(items: { label: string; x: number; w: number }[], isTop: boolean) {
    return items.filter(m => m.x + m.w > 0 && m.x < cw).map((m, i) => (
      <div key={i} style={{
        position: 'absolute', left: m.x, width: m.w, height: '100%',
        display: 'flex', alignItems: 'center', paddingLeft: 6,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        color: isTop ? '#e2e2f0' : '#6b6b8a',
        fontSize: isTop ? 11 : 9,
        fontWeight: isTop ? 600 : 400,
        overflow: 'hidden',
      }}>{m.label}</div>
    ));
  }

  // Top row items
  const topItems: { label: string; x: number; w: number }[] = [];
  // Bottom row items
  const botItems: { label: string; x: number; w: number }[] = [];

  if (scale === 'years') {
    // Top: empty / Bottom: Years only
    let yr = startOfYear(VIEW_START);
    while (yr <= VIEW_END) {
      const next = addYears(yr, 1);
      const x = dateToPixel(yr, VIEW_START, colW) - scrollLeft;
      const w = dateToPixel(next, VIEW_START, colW) - scrollLeft - x;
      botItems.push({ label: String(yr.getFullYear()), x: Math.max(x, 0), w: w + Math.min(x, 0) });
      yr = next;
    }
  } else if (scale === 'year-quarter') {
    // Top: Years
    let yr = startOfYear(VIEW_START);
    while (yr <= VIEW_END) {
      const next = addYears(yr, 1);
      const x = dateToPixel(yr, VIEW_START, colW) - scrollLeft;
      const w = dateToPixel(next, VIEW_START, colW) - scrollLeft - x;
      topItems.push({ label: String(yr.getFullYear()), x: Math.max(x, 0), w: w + Math.min(x, 0) });
      yr = next;
    }
    // Bottom: Quarters
    let qr = startOfQuarter(VIEW_START);
    while (qr <= VIEW_END) {
      const next = addQuarters(qr, 1);
      const x = dateToPixel(qr, VIEW_START, colW) - scrollLeft;
      const w = dateToPixel(next, VIEW_START, colW) - scrollLeft - x;
      const q = Math.floor(qr.getMonth() / 3) + 1;
      botItems.push({ label: `Q${q}`, x: Math.max(x, 0), w: w + Math.min(x, 0) });
      qr = next;
    }
  } else if (scale === 'quarter-month') {
    // Top: Quarters
    let qr = startOfQuarter(VIEW_START);
    while (qr <= VIEW_END) {
      const next = addQuarters(qr, 1);
      const x = dateToPixel(qr, VIEW_START, colW) - scrollLeft;
      const w = dateToPixel(next, VIEW_START, colW) - scrollLeft - x;
      const q = Math.floor(qr.getMonth() / 3) + 1;
      topItems.push({ label: `Q${q} ${qr.getFullYear()}`, x: Math.max(x, 0), w: w + Math.min(x, 0) });
      qr = next;
    }
    // Bottom: Months
    let mo = startOfMonth(VIEW_START);
    while (mo <= VIEW_END) {
      const next = addMonths(mo, 1);
      const x = dateToPixel(mo, VIEW_START, colW) - scrollLeft;
      const w = dateToPixel(next, VIEW_START, colW) - scrollLeft - x;
      botItems.push({ label: format(mo, 'MMM'), x: Math.max(x, 0), w: w + Math.min(x, 0) });
      mo = next;
    }
  } else {
    // Top: Months
    let mo = startOfMonth(VIEW_START);
    while (mo <= VIEW_END) {
      const next = addMonths(mo, 1);
      const x = dateToPixel(mo, VIEW_START, colW) - scrollLeft;
      const w = dateToPixel(next, VIEW_START, colW) - scrollLeft - x;
      topItems.push({ label: format(mo, 'MM/yyyy'), x: Math.max(x, 0), w: w + Math.min(x, 0) });
      mo = next;
    }
    // Bottom: Days
    const visFirst = Math.max(0, Math.floor(scrollLeft / colW));
    const visLast  = Math.min(totalDays - 1, Math.ceil((scrollLeft + 2400) / colW));
    const todayStr = format(today, 'yyyy-MM-dd');
    for (let i = visFirst; i <= visLast; i++) {
      const dd = new Date(VIEW_START); dd.setDate(VIEW_START.getDate() + i);
      const x = i * colW - scrollLeft;
      const isTd = format(dd, 'yyyy-MM-dd') === todayStr;
      const wk = isWeekend(dd);
      botItems.push({
        label: colW >= 14 ? format(dd, 'd') : '',
        x,
        w: colW,
      });
      // We'll render day items differently (with background color)
      void isTd; void wk; // suppress unused warnings - rendered in JSX below
    }
  }

  const visFirst2 = Math.max(0, Math.floor(scrollLeft / colW));
  const visLast2  = Math.min(totalDays - 1, Math.ceil((scrollLeft + 2400) / colW));
  const todayStr  = format(today, 'yyyy-MM-dd');

  // Cursor logic
  let cursor = dragging ? 'grabbing' : 'default';
  if (ctrlHeld) cursor = 'crosshair';

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: 'hidden', position: 'relative', background: C.bg, cursor, userSelect: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      onWheel={onWheel}
    >
      {/* ── Header ── */}
      <div style={{ height: HEADER_H, background: '#13131a', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, zIndex: 10, overflow: 'hidden', pointerEvents: 'none' }}>
        {/* Top row */}
        <div style={{ height: 27, borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
          {makeRow(topItems, true)}
        </div>
        {/* Bottom row */}
        <div style={{ height: 25, position: 'relative' }}>
          {scale === 'month-day' ? (
            Array.from({ length: visLast2 - visFirst2 + 1 }, (_, i) => {
              const di = visFirst2 + i;
              const dd = new Date(VIEW_START); dd.setDate(VIEW_START.getDate() + di);
              const x = di * colW - scrollLeft;
              const isTd = format(dd, 'yyyy-MM-dd') === todayStr;
              const wk = isWeekend(dd);
              return (
                <div key={i} style={{
                  position: 'absolute', left: x, width: colW, height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRight: '1px solid rgba(255,255,255,0.04)',
                  background: isTd ? 'rgba(168,85,247,0.12)' : wk ? 'rgba(255,255,255,0.02)' : 'transparent',
                  color: isTd ? '#a855f7' : wk ? '#4a4a6a' : '#5a5a7a',
                  fontSize: colW >= 18 ? 9 : 7, fontWeight: isTd ? 700 : 400, overflow: 'hidden',
                }}>
                  {colW >= 14 ? format(dd, 'd') : ''}
                </div>
              );
            })
          ) : makeRow(botItems, false)}
        </div>
      </div>

      {/* ── Canvas layers ── */}
      <canvas ref={gridRef}    style={{ position: 'absolute', top: HEADER_H, left: 0, pointerEvents: 'none' }} />
      <canvas ref={barsRef}    style={{ position: 'absolute', top: HEADER_H, left: 0, pointerEvents: 'none' }} />
      <canvas ref={depsRef}    style={{ position: 'absolute', top: HEADER_H, left: 0, pointerEvents: 'none' }} />
      <canvas ref={overlayRef} style={{ position: 'absolute', top: HEADER_H, left: 0, pointerEvents: 'none' }} />
      <canvas ref={connectRef} style={{ position: 'absolute', top: HEADER_H, left: 0, pointerEvents: 'none' }} />

      {/* Ctrl mode hint */}
      {ctrlHeld && (
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(168,85,247,0.9)', color: '#fff', fontSize: 11, fontWeight: 600,
          padding: '4px 12px', borderRadius: 12, pointerEvents: 'none', zIndex: 20,
        }}>
          {pendingDep
            ? `${tasks.find(tk => tk.id === pendingDep.taskId)?.name} (${pendingDep.side}) → ${t('ctrlHintPending')}`
            : t('ctrlHint')}
        </div>
      )}
    </div>
  );
};

import { jsPDF } from 'jspdf';
import { useViewStore } from '../store/viewStore';
import { useGanttStore } from '../store/ganttStore';
import { isWeekend } from './dateUtils';
import { differenceInCalendarDays, format, startOfMonth, addMonths, startOfQuarter, addQuarters, startOfYear, addYears } from 'date-fns';

const HEADER_H = 52; // must match Timeline.tsx

type ScaleLevel = 'years' | 'year-quarter' | 'quarter-month' | 'month-day';
function getScale(colW: number): ScaleLevel {
  if (colW < 1.5) return 'years';
  if (colW < 4)   return 'year-quarter';
  if (colW < 9)   return 'quarter-month';
  return 'month-day';
}

function drawScale(
  ctx: CanvasRenderingContext2D,
  w: number,
  scrollLeft: number,
  colW: number,
  viewStart: Date,
  viewEnd: Date,
): void {
  const scale = getScale(colW);
  const today = new Date();

  // Header background
  ctx.fillStyle = '#13131a';
  ctx.fillRect(0, 0, w, HEADER_H);

  // Top/bottom row separator
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 27); ctx.lineTo(w, 27); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, HEADER_H); ctx.lineTo(w, HEADER_H); ctx.stroke();

  const dateToX = (d: Date) =>
    differenceInCalendarDays(d, viewStart) * colW - scrollLeft;

  const drawLabel = (
    label: string, x: number, endX: number, y: number, h2: number,
    isTop: boolean,
  ) => {
    const cx = Math.max(x, 0);
    const cw = endX - cx;
    if (cw <= 0) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.5, y + h2); ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.rect(cx, y, cw, h2); ctx.clip();
    ctx.fillStyle = isTop ? '#e2e2f0' : '#6b6b8a';
    ctx.font = isTop ? '600 11px Inter,system-ui' : '400 9px Inter,system-ui';
    ctx.fillText(label, cx + 6, y + h2 / 2 + 4);
    ctx.restore();
  };

  const buildRanges = (): { top: {label:string; x:number; ex:number}[]; bot: {label:string; x:number; ex:number}[] } => {
    const top: {label:string; x:number; ex:number}[] = [];
    const bot: {label:string; x:number; ex:number}[] = [];

    if (scale === 'years') {
      let d = startOfYear(viewStart);
      while (d <= viewEnd) {
        const nx = addYears(d, 1);
        bot.push({ label: String(d.getFullYear()), x: dateToX(d), ex: dateToX(nx) });
        d = nx;
      }
    } else if (scale === 'year-quarter') {
      let d = startOfYear(viewStart);
      while (d <= viewEnd) {
        const nx = addYears(d, 1);
        top.push({ label: String(d.getFullYear()), x: dateToX(d), ex: dateToX(nx) });
        d = nx;
      }
      let q = startOfQuarter(viewStart);
      while (q <= viewEnd) {
        const nx = addQuarters(q, 1);
        const qi = Math.floor(q.getMonth() / 3) + 1;
        bot.push({ label: `Q${qi}`, x: dateToX(q), ex: dateToX(nx) });
        q = nx;
      }
    } else if (scale === 'quarter-month') {
      let q = startOfQuarter(viewStart);
      while (q <= viewEnd) {
        const nx = addQuarters(q, 1);
        const qi = Math.floor(q.getMonth() / 3) + 1;
        top.push({ label: `Q${qi} ${q.getFullYear()}`, x: dateToX(q), ex: dateToX(nx) });
        q = nx;
      }
      let m = startOfMonth(viewStart);
      while (m <= viewEnd) {
        const nx = addMonths(m, 1);
        bot.push({ label: format(m, 'MMM'), x: dateToX(m), ex: dateToX(nx) });
        m = nx;
      }
    } else {
      let m = startOfMonth(viewStart);
      while (m <= viewEnd) {
        const nx = addMonths(m, 1);
        top.push({ label: format(m, 'MM/yyyy'), x: dateToX(m), ex: dateToX(nx) });
        m = nx;
      }
      const firstDay = Math.max(0, Math.floor(scrollLeft / colW));
      const lastDay = Math.min(
        differenceInCalendarDays(viewEnd, viewStart),
        Math.ceil((scrollLeft + w) / colW),
      );
      for (let i = firstDay; i <= lastDay; i++) {
        const d = new Date(viewStart);
        d.setDate(viewStart.getDate() + i);
        const x = i * colW - scrollLeft;
        const todayStr = format(today, 'yyyy-MM-dd');
        const wk = isWeekend(d);
        const isTd = format(d, 'yyyy-MM-dd') === todayStr;
        // Day background
        ctx.fillStyle = isTd
          ? 'rgba(168,85,247,0.12)'
          : wk ? 'rgba(255,255,255,0.02)' : 'transparent';
        if (ctx.fillStyle !== 'transparent') ctx.fillRect(x, 27, colW, HEADER_H - 27);
        bot.push({ label: colW >= 14 ? format(d, 'd') : '', x, ex: x + colW });
      }
    }
    return { top, bot };
  };

  const { top, bot } = buildRanges();
  top.forEach(r => { if (r.x < w && r.ex > 0) drawLabel(r.label, r.x, r.ex, 0, 27, true); });
  bot.forEach(r => { if (r.x < w && r.ex > 0) drawLabel(r.label, r.x, r.ex, 27, HEADER_H - 27, false); });

  // Today line in header
  const todayX = Math.round(differenceInCalendarDays(today, viewStart) * colW - scrollLeft) + 0.5;
  if (todayX >= 0 && todayX <= w) {
    ctx.strokeStyle = 'rgba(168,85,247,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(todayX, 0); ctx.lineTo(todayX, HEADER_H); ctx.stroke();
  }
}

export function exportGanttPdf(): void {
  // Access Zustand stores outside React
  const { scrollLeft, viewStart, viewEnd } = useViewStore.getState();
  const { settings } = useGanttStore.getState();
  const colW = settings.columnWidth * settings.zoomFactor;

  // Only capture canvas elements that are inside the timeline/histogram area
  // (exclude any full-screen canvases)
  const allCanvases = Array.from(document.querySelectorAll<HTMLCanvasElement>('canvas'));
  if (allCanvases.length === 0) { alert('Nothing to export'); return; }

  const allRects = allCanvases.map(c => c.getBoundingClientRect());

  // Filter out zero-size canvases
  const pairs = allCanvases
    .map((c, i) => ({ c, r: allRects[i] }))
    .filter(p => p.r.width > 0 && p.r.height > 0);

  if (pairs.length === 0) return;

  const minX = Math.min(...pairs.map(p => p.r.left));
  const minY = Math.min(...pairs.map(p => p.r.top));
  const maxX = Math.max(...pairs.map(p => p.r.right));
  const maxY = Math.max(...pairs.map(p => p.r.bottom));

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const totalH   = HEADER_H + contentH; // add scale header on top

  const DPR = 2;
  const composite = document.createElement('canvas');
  composite.width  = Math.round(contentW * DPR);
  composite.height = Math.round(totalH * DPR);
  const ctx = composite.getContext('2d');
  if (!ctx) return;

  ctx.scale(DPR, DPR);

  // ── Draw scale header ──
  drawScale(ctx, contentW, scrollLeft, colW, viewStart, viewEnd);

  // ── Draw gantt background ──
  ctx.fillStyle = '#0f0f18';
  ctx.fillRect(0, HEADER_H, contentW, contentH);

  // ── Draw canvas layers (offset down by HEADER_H) ──
  pairs.forEach(({ c, r }) => {
    try {
      ctx.drawImage(c, r.left - minX, r.top - minY + HEADER_H, r.width, r.height);
    } catch (_) {}
  });

  // ── Create PDF ──
  const imgData = composite.toDataURL('image/png');
  const pxPerMm = 3.7795;
  const pdfW = contentW / pxPerMm;
  const pdfH = totalH   / pxPerMm;
  const orientation: 'landscape' | 'portrait' = pdfW > pdfH ? 'landscape' : 'portrait';

  const pdf = new jsPDF({ orientation, unit: 'mm', format: [pdfW, pdfH] });
  pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
  pdf.save(`gantt-${new Date().toISOString().slice(0, 10)}.pdf`);
}

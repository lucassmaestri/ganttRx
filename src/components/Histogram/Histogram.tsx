import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGanttStore } from '../../store/ganttStore';
import { useViewStore } from '../../store/viewStore';
import { allocateToBuckets, aggregateBuckets } from '../../lib/betaDistribution';
import { isWeekend } from '../../lib/dateUtils';
import { format } from 'date-fns';
import { VIEW_START } from '../../lib/constants';

const COLORS = ['#3b82f6', '#a855f7', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#f97316', '#8b5cf6'];
function getColor(idx: number): string { return COLORS[idx % COLORS.length]; }

type ColorMode = 'resource' | 'task';

interface HistogramProps {
  height: number;
  leftOffset: number;
}

export const Histogram: React.FC<HistogramProps> = ({ height, leftOffset }) => {
  const settings  = useGanttStore(s => s.settings);
  const resources = useGanttStore(s => s.resources);
  const tasks     = useGanttStore(s => s.tasks);
  const { scrollLeft } = useViewStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [colorMode, setColorMode] = useState<ColorMode>('resource');
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const colW    = settings.columnWidth * settings.zoomFactor;
  const headerH = 26;
  const chartH  = height - headerH;
  const REF_LINES = [8, 16];

  // ─── Per-resource buckets — O(resource duration), not O(view range) ────────
  const allBuckets = useMemo(
    () => resources.map(r => allocateToBuckets(r)),
    [resources],
  );

  // ─── Aggregated by date — for resource color mode ─────────────────────────
  const buckets = useMemo(() => aggregateBuckets(allBuckets), [allBuckets]);

  // ─── Per-task per-date hours — for task color mode (pre-computed) ──────────
  // Map: taskId → (dateStr → hours)
  const taskDayMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    resources.forEach((r, i) => {
      const bkts = allBuckets[i];
      bkts.forEach(b => {
        const key = b.date.toISOString().slice(0, 10);
        if (!map.has(r.taskId)) map.set(r.taskId, new Map());
        const m = map.get(r.taskId)!;
        m.set(key, (m.get(key) ?? 0) + b.total);
      });
    });
    return map;
  }, [resources, allBuckets]);

  const maxTotal = useMemo(() =>
    Math.max(...buckets.map(b => b.total), ...REF_LINES, 1),
  [buckets]);

  // ─── Legend entries ─────────────────────────────────────────────────────────
  const legendEntries = useMemo(() => {
    if (colorMode === 'resource') {
      const names = [...new Set(resources.map(r => r.resourceName))];
      return names.map((name, i) => ({ key: name, label: name, color: getColor(i) }));
    } else {
      const taskIds = [...new Set(resources.map(r => r.taskId))];
      return taskIds.map(tid => {
        const task = tasks.find(t => t.id === tid);
        return { key: tid, label: task?.name ?? tid, color: task?.color ?? '#3b82f6' };
      });
    }
  }, [colorMode, resources, tasks]);

  const allResourceNames = useMemo(() => [...new Set(resources.map(r => r.resourceName))], [resources]);

  const toggleHidden = (key: string) => {
    setHiddenKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ─── Draw canvas ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    if (width <= 0 || chartH <= 0) return;
    canvas.width  = width;
    canvas.height = chartH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0f0f18';
    ctx.fillRect(0, 0, width, chartH);

    // Grid (optional, batched)
    if (settings.showGrid) {
      const gFirst = Math.floor(scrollLeft / colW);
      const gLast  = Math.ceil((scrollLeft + width) / colW);
      ctx.strokeStyle = 'rgba(255,255,255,0.02)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = gFirst; i <= gLast; i++) {
        const gx = Math.round(i * colW - scrollLeft) + 0.5;
        ctx.moveTo(gx, 0); ctx.lineTo(gx, chartH);
      }
      ctx.stroke();
    }

    const bucketMap = new Map(buckets.map(b => [format(b.date, 'yyyy-MM-dd'), b]));
    const firstDay = Math.floor(scrollLeft / colW);
    const lastDay  = Math.ceil((scrollLeft + width) / colW);

    // ─── Bars ────────────────────────────────────────────────────────────────
    for (let i = firstDay; i <= lastDay; i++) {
      const dayDate = new Date(VIEW_START);
      dayDate.setDate(VIEW_START.getDate() + i);
      const x = i * colW - scrollLeft;

      if (isWeekend(dayDate)) {
        ctx.fillStyle = 'rgba(255,255,255,0.018)';
        ctx.fillRect(x, 0, colW, chartH);
      }

      if (colorMode === 'resource') {
        const bucket = bucketMap.get(format(dayDate, 'yyyy-MM-dd'));
        if (bucket) {
          let yOffset = chartH;
          Object.entries(bucket.byResource).forEach(([res, hours]) => {
            if (hours <= 0 || hiddenKeys.has(res)) return;
            const idx = allResourceNames.indexOf(res);
            const barH = (hours / maxTotal) * chartH;
            yOffset -= barH;
            ctx.fillStyle = getColor(idx);
            ctx.fillRect(x + 1, yOffset, Math.max(colW - 2, 1), barH);
          });
        }
      } else {
        // Task color mode — use pre-computed taskDayMap (no per-frame allocateToBuckets calls)
        const dateKey = format(dayDate, 'yyyy-MM-dd');
        let yOffset = chartH;
        taskDayMap.forEach((dateMap, taskId) => {
          if (hiddenKeys.has(taskId)) return;
          const hours = dateMap.get(dateKey) ?? 0;
          if (hours <= 0) return;
          const entry = legendEntries.find(e => e.key === taskId);
          const barH = (hours / maxTotal) * chartH;
          yOffset -= barH;
          ctx.fillStyle = entry?.color ?? '#3b82f6';
          ctx.fillRect(x + 1, yOffset, Math.max(colW - 2, 1), barH);
        });
      }
    }

    // Peak value label
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 9px Inter,system-ui';
    ctx.fillText(`${maxTotal.toFixed(1)}h`, 4, 12);

    // Reference lines
    REF_LINES.forEach((hours, idx) => {
      const y = chartH - (hours / maxTotal) * chartH;
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = idx === 0 ? 'rgba(34,197,94,0.65)' : 'rgba(239,68,68,0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = idx === 0 ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)';
      ctx.font = 'bold 9px Inter,system-ui';
      ctx.fillText(`${hours}h`, 4, y - 3);
    });
  }, [buckets, taskDayMap, scrollLeft, colW, chartH, maxTotal, colorMode, hiddenKeys,
      legendEntries, allResourceNames, settings.showGrid]);

  return (
    <div style={{
      height, display: 'flex', flexShrink: 0,
      borderTop: '2px solid rgba(255,255,255,0.08)', overflow: 'hidden',
    }}>
      {/* ── Left sidebar ── */}
      <div style={{
        width: leftOffset, flexShrink: 0, background: '#13131a',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          height: headerH, borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6,
        }}>
          <span style={{ color: '#6b6b8a', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, flex: 1 }}>
            Resources
          </span>
          <button
            onClick={() => setColorMode(m => m === 'resource' ? 'task' : 'resource')}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 3, color: colorMode === 'task' ? '#a855f7' : '#6b6b8a',
              fontSize: 9, padding: '1px 5px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {colorMode === 'resource' ? 'By Resource' : 'By Task'}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {legendEntries.map(entry => {
            const hidden = hiddenKeys.has(entry.key);
            return (
              <div key={entry.key} onClick={() => toggleHidden(entry.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', opacity: hidden ? 0.3 : 1 }}>
                <div style={{ width: 9, height: 9, borderRadius: 2, background: entry.color, flexShrink: 0 }} />
                <span style={{ color: '#8a8aaa', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Canvas area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0f0f18' }}>
        <div style={{
          height: headerH, background: '#13131a',
          borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
        }} />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <canvas ref={canvasRef} style={{ display: 'block', position: 'absolute', inset: 0 }} />
        </div>
      </div>
    </div>
  );
};

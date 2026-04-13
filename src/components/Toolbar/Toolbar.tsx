import React, { useState } from 'react';
import { useGanttStore } from '../../store/ganttStore';
import { useSelectionStore } from '../../store/selectionStore';
import type { GanttMarker } from '../../types';
import { format, parseISO } from 'date-fns';
import { useLang } from '../../i18n';
import { exportGanttPdf } from '../../lib/pdfExport';

interface ToolbarProps {
  onAddTask: () => void;
  onAddGroup: () => void;
  onAddMilestone: () => void;
  onOpenRescheduling: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onAddTask, onAddGroup, onAddMilestone, onOpenRescheduling }) => {
  const settings = useGanttStore(s => s.settings);
  const setSettings = useGanttStore(s => s.setSettings);
  const runAutoSchedule = useGanttStore(s => s.runAutoSchedule);
  const runCriticalPath = useGanttStore(s => s.runCriticalPath);
  const addMarker = useGanttStore(s => s.addMarker);
  const markers = useGanttStore(s => s.markers);
  const removeMarker = useGanttStore(s => s.removeMarker);
  const selectedIds = useSelectionStore(s => s.selectedIds);
  const tasks = useGanttStore(s => s.tasks);

  const { t, lang, setLang } = useLang();

  const [showMarkerForm, setShowMarkerForm] = useState(false);
  const [markerDate, setMarkerDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [markerLabel, setMarkerLabel] = useState('');

  const toggle = (key: keyof typeof settings) =>
    setSettings({ [key]: !settings[key as keyof typeof settings] } as Partial<typeof settings>);

  const handleAutoSchedule = () => {
    runAutoSchedule(selectedIds.size > 0 ? selectedIds : undefined);
    if (settings.showCriticalPath) runCriticalPath();
    onOpenRescheduling();
  };

  const handleCritical = () => {
    const next = !settings.showCriticalPath;
    setSettings({ showCriticalPath: next });
    if (next) runCriticalPath();
  };

  const handleAddMarker = () => {
    if (!markerDate) return;
    const marker: GanttMarker = {
      id: `m-${Date.now()}`,
      date: parseISO(markerDate),
      label: markerLabel || 'M',
      color: '#fbbf24',
    };
    addMarker(marker);
    setShowMarkerForm(false);
    setMarkerLabel('');
  };

  const handleFit = () => {
    if (tasks.length === 0) { setSettings({ zoomFactor: 1 }); return; }
    const el = document.querySelector('[data-timeline]') as HTMLElement;
    if (!el) { setSettings({ zoomFactor: 1 }); return; }
    const containerWidth = el.clientWidth;
    const nonGroups = tasks.filter(t => t.type !== 'group');
    const items = nonGroups.length > 0 ? nonGroups : tasks;
    const minMs = Math.min(...items.map(t => t.plannedStart.getTime()));
    const maxMs = Math.max(...items.map(t => t.plannedEnd.getTime()));
    const spanDays = Math.max(1, Math.ceil((maxMs - minMs) / 86400000) + 1);
    const padDays = Math.max(2, Math.floor(spanDays * 0.05));
    const totalDays = spanDays + padDays * 2;
    const newZoom = Math.max(0.03, Math.min(8, (containerWidth / totalDays) / settings.columnWidth));
    const newColW = settings.columnWidth * newZoom;
    el.dispatchEvent(new CustomEvent('fit-tasks', { detail: { minMs, newZoom, newColW, padDays } }));
    setSettings({ zoomFactor: newZoom });
  };

  const handleScrollToday = () => {
    // Signal via setting change (Timeline listens)
    setSettings({ zoomFactor: settings.zoomFactor }); // no-op but triggers redraw
    const el = document.querySelector('[data-timeline]') as HTMLElement;
    if (el) el.dispatchEvent(new CustomEvent('scroll-today'));
  };

  const taskCount = tasks.filter(t => t.type !== 'group').length;

  return (
    <div style={{
      height: 'var(--gantt-rx-toolbar-height)',
      background: '#13131a',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      padding: '0 10px',
      flexShrink: 0,
      overflowX: 'auto',
    }}>
      {/* Add */}
      <button className="gantt-btn primary" onClick={onAddTask}>{t('addTask')}</button>
      <button className="gantt-btn" onClick={onAddGroup}>
        <span style={{ color: '#4f46e5' }}>⬛</span> {t('addGroup')}
      </button>
      <button className="gantt-btn" onClick={onAddMilestone}>
        <span style={{ color: '#f59e0b' }}>◆</span> {t('addMilestone')}
      </button>

      <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.08)', margin: '0 3px' }} />

      {/* View toggles */}
      <button className={`gantt-btn danger ${settings.showCriticalPath ? 'active' : ''}`} onClick={handleCritical}>
        {t('critical')}
      </button>
      <button className={`gantt-btn ${settings.showHistogram ? 'active' : ''}`} onClick={() => toggle('showHistogram')}>
        {t('histogram')}
      </button>
      <button className={`gantt-btn ${settings.showDependencies ? 'active' : ''}`} onClick={() => toggle('showDependencies')}>
        {t('deps')}
      </button>
      <button className={`gantt-btn ${settings.showBaseline ? 'active' : ''}`} onClick={() => toggle('showBaseline')}>
        {t('baseline')}
      </button>
      <button className={`gantt-btn ${settings.showGrid ? 'active' : ''}`} onClick={() => toggle('showGrid')}>
        {t('grid')}
      </button>
      <button className={`gantt-btn ${settings.showActualBars ? 'active' : ''}`} onClick={() => toggle('showActualBars')}>
        {t('actualBars')}
      </button>

      <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.08)', margin: '0 3px' }} />

      {/* Actions */}
      <button className="gantt-btn primary" onClick={handleAutoSchedule}>{t('autoSchedule')}</button>

      <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.08)', margin: '0 3px' }} />

      {/* Markers */}
      <div style={{ position: 'relative' }}>
        <button className="gantt-btn" onClick={() => setShowMarkerForm(v => !v)}>
          {t('markers')} {markers.length > 0 && <span style={{ color: '#fbbf24', fontSize: 10 }}>({markers.length})</span>}
        </button>
        {showMarkerForm && (
          <div style={{
            position: 'absolute', top: 36, left: 0, zIndex: 50,
            background: '#1a1a26', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6, padding: 10, width: 260,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ color: '#a855f7', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{t('addMarkerTitle')}</div>
            <input
              className="gantt-input"
              type="date"
              value={markerDate}
              onChange={e => setMarkerDate(e.target.value)}
            />
            <input
              className="gantt-input"
              placeholder="Label (ex: Sprint 1)"
              value={markerLabel}
              onChange={e => setMarkerLabel(e.target.value)}
            />
            <button className="gantt-btn primary" onClick={handleAddMarker}>{t('addMarkerBtn')}</button>
            {markers.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 6, maxHeight: 120, overflowY: 'auto' }}>
                {markers.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                    <span style={{ color: m.color, fontSize: 11 }}>🏳 {m.label} — {format(m.date, 'dd/MM/yy')}</span>
                    <button className="gantt-btn danger" style={{ padding: '1px 5px', fontSize: 10 }} onClick={() => removeMarker(m.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <button className="gantt-btn" style={{ color: '#a855f7' }} onClick={handleScrollToday}>{t('today')}</button>

      {/* Language toggle */}
      <button
        className="gantt-btn"
        style={{ color: '#a855f7', borderColor: 'rgba(168,85,247,0.3)' }}
        onClick={() => setLang(lang === 'pt-BR' ? 'en-US' : 'pt-BR')}
      >
        {t('language')}
      </button>

      {/* PDF export */}
      <button className="gantt-btn" onClick={() => exportGanttPdf()} style={{ color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)' }}>
        {t('exportPdf')}
      </button>

      <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.08)', margin: '0 3px' }} />

      {/* Zoom */}
      <button className="gantt-btn" onClick={() => setSettings({ zoomFactor: Math.min(5, settings.zoomFactor * 1.25) })}>+</button>
      <span style={{ color: '#6b6b8a', fontSize: 10, minWidth: 34, textAlign: 'center' }}>{Math.round(settings.zoomFactor * 100)}%</span>
      <button className="gantt-btn" onClick={() => setSettings({ zoomFactor: Math.max(0.03, settings.zoomFactor * 0.8) })}>−</button>
      <button className="gantt-btn" onClick={handleFit}>{t('fit')}</button>

      <div style={{ flex: 1 }} />

      {/* Monitor */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 8px', background: '#0a0a0f',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, fontSize: 10,
        color: '#6b6b8a',
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
        {t('tasks')}: {taskCount} | {t('ready')}
      </div>

      <button
        className="gantt-btn"
        style={{ fontSize: 10, color: '#a855f7', borderColor: 'rgba(168,85,247,0.3)' }}
        onClick={() => window.location.reload()}
      >
        FORCE RE-RENDER
      </button>
    </div>
  );
};

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { GanttTask, TaskListColumn } from '../../types';
import { useGanttStore } from '../../store/ganttStore';
import { useSelectionStore } from '../../store/selectionStore';
import { useViewStore } from '../../store/viewStore';
import { differenceInCalendarDays } from 'date-fns';
import { formatDateShort } from '../../lib/dateUtils';
import { analyzeRescheduling } from '../../lib/ganttUtils';

interface TaskListProps {
  tasks: GanttTask[];
  width: number;
}

// ─── Column definitions ───────────────────────────────────────────────────────
const ALL_COLUMNS: { key: TaskListColumn; label: string; width: number }[] = [
  { key: 'start',    label: 'START', width: 52 },
  { key: 'end',      label: 'END',   width: 52 },
  { key: 'duration', label: 'DUR',   width: 34 },
  { key: 'progress', label: '%',     width: 32 },
  { key: 'wbs',      label: 'WBS',   width: 46 },
  { key: 'location', label: 'LOC',   width: 64 },
  { key: 'notes',    label: 'NOTES', width: 80 },
];

// ─── Behind-schedule warning icon ────────────────────────────────────────────
const WarnIcon = () => (
  <svg
    width="11" height="11" viewBox="0 0 11 11" fill="none"
    style={{ flexShrink: 0, marginRight: 3 }}
    aria-label="Behind schedule"
  >
    <path d="M5.5 1L10.3 9.5H0.7L5.5 1Z" fill="#f59e0b" stroke="#f59e0b" strokeWidth="0.5" strokeLinejoin="round" />
    <path d="M5.5 4.5V6.5" stroke="#0a0a0f" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="5.5" cy="7.8" r="0.55" fill="#0a0a0f" />
  </svg>
);

export const TaskList: React.FC<TaskListProps> = ({ tasks, width }) => {
  const rowHeight      = useGanttStore(s => s.settings.rowHeight);
  const visibleColumns = useGanttStore(s => s.settings.visibleColumns);
  const setSettings    = useGanttStore(s => s.setSettings);
  const allTasks       = useGanttStore(s => s.tasks);
  const toggleGroup    = useGanttStore(s => s.toggleGroup);
  const { selectedIds, toggleSelect, openPanel } = useSelectionStore();
  const scrollTop    = useViewStore(s => s.scrollTop);
  const setScrollTop = useViewStore(s => s.setScrollTop);

  const scrollRef    = useRef<HTMLDivElement>(null);
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  // ─── Behind-schedule set ────────────────────────────────────────────────────
  const behindScheduleIds = useMemo(() => {
    const suggestions = analyzeRescheduling(allTasks);
    return new Set(suggestions.map(s => s.taskId));
  }, [allTasks]);

  // ─── Close picker on outside click ─────────────────────────────────────────
  useEffect(() => {
    if (!colPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setColPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colPickerOpen]);

  const rowVirtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  React.useEffect(() => {
    if (scrollRef.current && Math.abs(scrollRef.current.scrollTop - scrollTop) > 1) {
      scrollRef.current.scrollTop = scrollTop;
    }
  }, [scrollTop]);

  const toggleColumn = (key: TaskListColumn) => {
    const next = visibleColumns.includes(key)
      ? visibleColumns.filter(c => c !== key)
      : [...visibleColumns, key];
    setSettings({ visibleColumns: next });
  };

  const activeCols = ALL_COLUMNS.filter(c => visibleColumns.includes(c.key));

  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0 }}>
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        height: 'var(--gantt-header-height)',
        background: 'var(--gantt-surface)',
        borderRight: '1px solid var(--gantt-border)',
        borderBottom: '1px solid var(--gantt-border)',
        display: 'flex',
        alignItems: 'flex-end',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          width: '100%',
          borderTop: '1px solid var(--gantt-border)',
          paddingTop: 4,
          paddingBottom: 4,
          alignItems: 'center',
        }}>
          <div style={{ flex: 1, paddingLeft: 12, color: 'var(--gantt-text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            TASK
          </div>

          {activeCols.map(col => (
            <div key={col.key} style={{ width: col.width, textAlign: 'center', color: 'var(--gantt-text-muted)', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
              {col.label}
            </div>
          ))}

          {/* Column picker */}
          <div ref={colPickerRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setColPickerOpen(v => !v)}
              title="Add / remove columns"
              style={{
                background: colPickerOpen ? 'rgba(168,85,247,0.15)' : 'none',
                border: '1px solid ' + (colPickerOpen ? 'rgba(168,85,247,0.5)' : 'transparent'),
                color: colPickerOpen ? '#a855f7' : 'var(--gantt-text-dim)',
                cursor: 'pointer',
                padding: '0 6px',
                height: 20,
                borderRadius: 3,
                fontSize: 13,
                lineHeight: '18px',
                display: 'flex',
                alignItems: 'center',
                marginRight: 4,
                transition: 'all 0.12s',
              }}
            >
              +
            </button>

            {colPickerOpen && (
              <div style={{
                position: 'absolute',
                top: 28,
                right: 0,
                zIndex: 60,
                background: '#1a1a26',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                padding: 8,
                minWidth: 160,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}>
                <div style={{ color: '#a855f7', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                  Columns
                </div>
                {ALL_COLUMNS.map(col => (
                  <label
                    key={col.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '4px 2px',
                      cursor: 'pointer',
                      borderRadius: 3,
                      color: visibleColumns.includes(col.key) ? 'var(--gantt-text)' : 'var(--gantt-text-muted)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      style={{ accentColor: '#a855f7', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 12 }}>{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Rows ───────────────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          borderRight: '1px solid var(--gantt-border)',
        }}
      >
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map(vrow => {
            const task       = tasks[vrow.index];
            const isSelected = selectedIds.has(task.id);
            const isGroup    = task.type === 'group';
            const isMilestone = task.type === 'milestone';
            const isBehind   = behindScheduleIds.has(task.id);
            const dur = Math.max(1, differenceInCalendarDays(task.plannedEnd, task.plannedStart) + 1);
            const indentLevel = task.parentId ? 1 : 0;

            return (
              <div
                key={task.id}
                style={{
                  position: 'absolute',
                  top: vrow.start,
                  left: 0,
                  width: '100%',
                  height: rowHeight,
                  display: 'flex',
                  alignItems: 'center',
                  background: isSelected
                    ? 'rgba(124,58,237,0.15)'
                    : vrow.index % 2 === 0
                      ? 'var(--gantt-bg)'
                      : 'rgba(255,255,255,0.015)',
                  borderBottom: '1px solid var(--gantt-border)',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                  userSelect: 'none',
                }}
                onClick={() => toggleSelect(task.id)}
                onDoubleClick={() => openPanel(task.id)}
              >
                {/* Indent */}
                <div style={{ width: indentLevel * 16 + 8, flexShrink: 0 }} />

                {/* Group collapse toggle */}
                {isGroup && (
                  <button
                    onClick={e => { e.stopPropagation(); toggleGroup(task.id); }}
                    style={{ background: 'none', border: 'none', color: 'var(--gantt-text-muted)', cursor: 'pointer', padding: '0 4px', fontSize: 10, flexShrink: 0 }}
                  >
                    {task.collapsed ? '▶' : '▼'}
                  </button>
                )}
                {!isGroup && <div style={{ width: 16, flexShrink: 0 }} />}

                {/* Type icon */}
                {isMilestone && (
                  <span style={{ color: 'var(--gantt-accent-amber)', fontSize: 10, marginRight: 4, flexShrink: 0 }}>◆</span>
                )}
                {isGroup && (
                  <span style={{ color: 'var(--gantt-bar-group)', fontSize: 10, marginRight: 4, flexShrink: 0 }}>⬛</span>
                )}
                {!isMilestone && !isGroup && task.isCritical && (
                  <span style={{ color: 'var(--gantt-bar-critical)', fontSize: 9, marginRight: 3, flexShrink: 0 }}>●</span>
                )}
                {!isMilestone && !isGroup && !task.isCritical && (
                  <span style={{ width: 12, flexShrink: 0 }} />
                )}

                {/* Behind-schedule warning */}
                {isBehind && <WarnIcon />}

                {/* Task name */}
                <div style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: isBehind ? '#fbbf24' : 'var(--gantt-text)',
                  fontWeight: isGroup ? 600 : 400,
                  fontSize: 12,
                }}>
                  {task.name}
                </div>

                {/* Dynamic column cells */}
                {activeCols.map(col => {
                  let value = '';
                  switch (col.key) {
                    case 'start':    value = formatDateShort(task.plannedStart); break;
                    case 'end':      value = formatDateShort(task.plannedEnd); break;
                    case 'duration': value = isMilestone ? '' : `${dur}d`; break;
                    case 'progress': value = isMilestone ? '' : `${task.progress}%`; break;
                    case 'wbs':      value = task.wbs ?? ''; break;
                    case 'location': value = task.location ?? ''; break;
                    case 'notes':    value = task.notes ? task.notes.slice(0, 12) + (task.notes.length > 12 ? '…' : '') : ''; break;
                  }
                  return (
                    <div
                      key={col.key}
                      title={col.key === 'notes' ? (task.notes ?? '') : undefined}
                      style={{
                        width: col.width,
                        textAlign: col.key === 'progress' ? 'right' : 'center',
                        paddingRight: col.key === 'progress' ? 6 : 0,
                        color: 'var(--gantt-text-muted)',
                        fontSize: 11,
                        flexShrink: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {value}
                    </div>
                  );
                })}

                {/* Spacer to align with the + button width in the header */}
                <div style={{ width: 22, flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

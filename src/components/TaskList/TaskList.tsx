import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { GanttTask } from '../../types';
import { useGanttStore } from '../../store/ganttStore';
import { useSelectionStore } from '../../store/selectionStore';
import { useViewStore } from '../../store/viewStore';
import { differenceInCalendarDays } from 'date-fns';
import { formatDateShort } from '../../lib/dateUtils';

interface TaskListProps {
  tasks: GanttTask[];
  width: number;
}

export const TaskList: React.FC<TaskListProps> = ({ tasks, width }) => {
  const rowHeight = useGanttStore(s => s.settings.rowHeight);
  const toggleGroup = useGanttStore(s => s.toggleGroup);
  const { selectedIds, toggleSelect, openPanel } = useSelectionStore();
  const scrollTop = useViewStore(s => s.scrollTop);
  const setScrollTop = useViewStore(s => s.setScrollTop);

  const scrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Sync scroll from timeline
  React.useEffect(() => {
    if (scrollRef.current && Math.abs(scrollRef.current.scrollTop - scrollTop) > 1) {
      scrollRef.current.scrollTop = scrollTop;
    }
  }, [scrollTop]);

  const COL_START = 52;
  const COL_DUR = 30;
  const COL_PROG = 30;

  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0 }}>
      {/* Header */}
      <div
        style={{
          height: 'var(--gantt-header-height)',
          background: 'var(--gantt-surface)',
          borderRight: '1px solid var(--gantt-border)',
          borderBottom: '1px solid var(--gantt-border)',
          display: 'flex',
          alignItems: 'flex-end',
          padding: '0 0 0 0',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', width: '100%', borderTop: '1px solid var(--gantt-border)', paddingTop: 4, paddingBottom: 4 }}>
          <div style={{ flex: 1, paddingLeft: 12, color: 'var(--gantt-text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            TASK
          </div>
          <div style={{ width: COL_START, textAlign: 'center', color: 'var(--gantt-text-muted)', fontSize: 11, fontWeight: 600 }}>START</div>
          <div style={{ width: COL_DUR, textAlign: 'center', color: 'var(--gantt-text-muted)', fontSize: 11, fontWeight: 600 }}>DUR</div>
          <div style={{ width: COL_PROG, textAlign: 'center', color: 'var(--gantt-text-muted)', fontSize: 11, fontWeight: 600, paddingRight: 4 }}>%</div>
        </div>
      </div>

      {/* Rows */}
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
            const task = tasks[vrow.index];
            const isSelected = selectedIds.has(task.id);
            const isGroup = task.type === 'group';
            const isMilestone = task.type === 'milestone';
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
                {/* Indent + expand toggle */}
                <div style={{ width: indentLevel * 16 + 8, flexShrink: 0 }} />

                {isGroup && (
                  <button
                    onClick={e => { e.stopPropagation(); toggleGroup(task.id); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--gantt-text-muted)',
                      cursor: 'pointer',
                      padding: '0 4px',
                      fontSize: 10,
                      flexShrink: 0,
                    }}
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

                {/* Name */}
                <div
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: isGroup ? 'var(--gantt-text)' : 'var(--gantt-text)',
                    fontWeight: isGroup ? 600 : 400,
                    fontSize: 12,
                  }}
                >
                  {task.name}
                </div>

                {/* Start */}
                <div style={{ width: COL_START, textAlign: 'center', color: 'var(--gantt-text-muted)', fontSize: 11, flexShrink: 0 }}>
                  {formatDateShort(task.plannedStart)}
                </div>

                {/* Duration */}
                <div style={{ width: COL_DUR, textAlign: 'center', color: 'var(--gantt-text-muted)', fontSize: 11, flexShrink: 0 }}>
                  {isMilestone ? '' : `${dur}d`}
                </div>

                {/* Progress */}
                <div style={{ width: COL_PROG, textAlign: 'right', paddingRight: 6, color: 'var(--gantt-text-muted)', fontSize: 11, flexShrink: 0 }}>
                  {isMilestone ? '' : `${task.progress}%`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

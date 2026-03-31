import React, { useEffect, useState } from 'react';
import type { GanttTask, DependencyType, DistributionCurve } from '../../types';
import { useGanttStore } from '../../store/ganttStore';
import { useSelectionStore } from '../../store/selectionStore';
import { parseISO, format } from 'date-fns';
import { useLang } from '../../i18n';

const COLORS = [
  '#e05252','#f59e0b','#22c55e','#3b82f6','#a855f7','#ec4899',
  '#06b6d4','#84cc16','#f97316','#4f46e5','#14b8a6','#8b5cf6',
];

const DISTRIBUTIONS: DistributionCurve[] = ['B-2','B-1','B0','B+1','B+2','flat'];
const DEP_TYPES: DependencyType[] = ['FS','SS','FF','SF'];

interface PropsPanelProps {}

export const PropertiesPanel: React.FC<PropsPanelProps> = () => {
  const { t } = useLang();
  const { activeTaskId, isPanelOpen, closePanel } = useSelectionStore();
  const tasks = useGanttStore(s => s.tasks);
  const deps = useGanttStore(s => s.dependencies);
  const resources = useGanttStore(s => s.resources);
  const updateTask = useGanttStore(s => s.updateTask);
  const addDependency = useGanttStore(s => s.addDependency);
  const removeDependency = useGanttStore(s => s.removeDependency);
  const updateDependency = useGanttStore(s => s.updateDependency);
  const addResource = useGanttStore(s => s.addResource);
  const updateResource = useGanttStore(s => s.updateResource);
  const removeResource = useGanttStore(s => s.removeResource);
  const deleteTask = useGanttStore(s => s.deleteTask);

  const task = tasks.find(t => t.id === activeTaskId) ?? null;
  const taskDeps = deps.filter(d => d.toId === activeTaskId);
  const taskResources = resources.filter(r => r.taskId === activeTaskId);

  const [form, setForm] = useState<Partial<GanttTask>>({});

  useEffect(() => {
    if (task) setForm({ ...task });
  }, [task?.id]);

  if (!isPanelOpen || !task) return null;

  const patch = (field: keyof GanttTask, val: unknown) => {
    setForm(f => ({ ...f, [field]: val }));
    updateTask(task.id, { [field]: val } as Partial<GanttTask>);
  };

  const patchDate = (field: 'plannedStart' | 'plannedEnd', val: string) => {
    try {
      const d = parseISO(val);
      if (!isNaN(d.getTime())) patch(field, d);
    } catch {}
  };

  const handleAddDep = () => {
    addDependency({
      id: `dep-${Date.now()}`,
      fromId: tasks[0]?.id ?? '',
      toId: task.id,
      type: 'FS',
      offsetDays: 0,
    });
  };

  const handleAddResource = () => {
    addResource({
      id: `res-${Date.now()}`,
      taskId: task.id,
      resourceName: 'Resource 1',
      startDate: task.plannedStart,
      endDate: task.plannedEnd,
      hours: 8,
      departments: [],
      distribution: 'flat',
    });
  };

  const fieldLabel = (label: string) => (
    <div style={{ color: 'var(--gantt-text-muted)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>
      {label}
    </div>
  );

  const section = (label: string) => (
    <div style={{ color: 'var(--gantt-text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, padding: '8px 0 4px', borderTop: '1px solid var(--gantt-border)' }}>
      {label}
    </div>
  );

  return (
    <div
      style={{
        width: 380,
        height: '100%',
        background: 'var(--gantt-surface)',
        borderLeft: '1px solid var(--gantt-border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--gantt-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ color: 'var(--gantt-text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>PROPERTIES</div>
          <div style={{ color: 'var(--gantt-text)', fontSize: 14, fontWeight: 600 }}>{task.name}</div>
        </div>
        <button
          className="gantt-btn"
          onClick={closePanel}
          style={{ padding: '2px 8px', fontSize: 14 }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Name */}
        <div>
          {fieldLabel(t('name'))}
          <input
            className="gantt-input"
            value={form.name ?? ''}
            onChange={e => patch('name', e.target.value)}
          />
        </div>

        {/* Type + Color */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            {fieldLabel(t('type'))}
            <select
              className="gantt-select"
              value={form.type ?? 'task'}
              onChange={e => patch('type', e.target.value)}
            >
              <option value="task">{t('task')}</option>
              <option value="group">{t('group')}</option>
              <option value="milestone">{t('milestone')}</option>
            </select>
          </div>
          <div>
            {fieldLabel(t('color'))}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 3, marginTop: 2 }}>
              {COLORS.map(c => (
                <div
                  key={c}
                  onClick={() => patch('color', c)}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    background: c,
                    borderRadius: 3,
                    cursor: 'pointer',
                    border: form.color === c ? '2px solid #fff' : '2px solid transparent',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Dates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            {fieldLabel(t('plannedStart'))}
            <input
              className="gantt-input"
              type="date"
              value={form.plannedStart ? format(form.plannedStart as Date, 'yyyy-MM-dd') : ''}
              onChange={e => patchDate('plannedStart', e.target.value)}
            />
          </div>
          <div>
            {fieldLabel(t('plannedEnd'))}
            <input
              className="gantt-input"
              type="date"
              value={form.plannedEnd ? format(form.plannedEnd as Date, 'yyyy-MM-dd') : ''}
              onChange={e => patchDate('plannedEnd', e.target.value)}
            />
          </div>
        </div>

        {/* Actual dates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            {fieldLabel(t('actualStart'))}
            <input
              className="gantt-input"
              type="date"
              value={form.actualStart ? format(form.actualStart as Date, 'yyyy-MM-dd') : ''}
              onChange={e => {
                try { const d = parseISO(e.target.value); if (!isNaN(d.getTime())) patch('actualStart', d); } catch {}
              }}
              placeholder="dd/mm/aaaa"
            />
          </div>
          <div>
            {fieldLabel(t('actualEnd'))}
            <input
              className="gantt-input"
              type="date"
              value={form.actualEnd ? format(form.actualEnd as Date, 'yyyy-MM-dd') : ''}
              onChange={e => {
                try { const d = parseISO(e.target.value); if (!isNaN(d.getTime())) patch('actualEnd', d); } catch {}
              }}
              placeholder="dd/mm/aaaa"
            />
          </div>
        </div>

        {/* Progress */}
        <div>
          {fieldLabel(`${t('progress')} (${form.progress ?? 0}%)`)}
          <input
            type="range"
            min={0} max={100}
            value={form.progress ?? 0}
            onChange={e => patch('progress', Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--gantt-accent-purple)' }}
          />
        </div>

        {/* Predecessors */}
        {section(t('predecessors'))}
        {taskDeps.map(dep => (
            <div key={dep.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <select
                className="gantt-select"
                value={dep.fromId}
                style={{ flex: 1, fontSize: 11 }}
                onChange={e => updateDependency(dep.id, { fromId: e.target.value })}
              >
                {tasks.filter(t => t.id !== task.id).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <select
                className="gantt-select"
                value={dep.type}
                style={{ width: 46, fontSize: 11 }}
                onChange={e => updateDependency(dep.id, { type: e.target.value as DependencyType })}
              >
                {DEP_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
              </select>
              <input
                className="gantt-input"
                type="number"
                value={dep.offsetDays}
                style={{ width: 36, textAlign: 'center' }}
                onChange={e => updateDependency(dep.id, { offsetDays: Number(e.target.value) })}
              />
              <button className="gantt-btn danger" style={{ padding: '2px 6px' }} onClick={() => removeDependency(dep.id)}>✕</button>
            </div>
        ))}
        <button className="gantt-btn" style={{ fontSize: 11 }} onClick={handleAddDep}>
          {t('addPredecessor')}
        </button>

        {/* Resources */}
        {section(t('resources'))}
        {taskResources.map(res => (
          <div key={res.id} style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="gantt-input"
              value={res.resourceName}
              style={{ flex: 1, minWidth: 80 }}
              onChange={e => updateResource(res.id, { resourceName: e.target.value })}
            />
            <input
              className="gantt-input"
              type="number"
              value={res.hours}
              style={{ width: 50 }}
              onChange={e => updateResource(res.id, { hours: Number(e.target.value) })}
            />
            <select
              className="gantt-select"
              value={res.distribution}
              style={{ width: 60, fontSize: 11 }}
              onChange={e => updateResource(res.id, { distribution: e.target.value as DistributionCurve })}
            >
              {DISTRIBUTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <button className="gantt-btn danger" style={{ padding: '2px 6px' }} onClick={() => removeResource(res.id)}>✕</button>
          </div>
        ))}
        <button className="gantt-btn" style={{ fontSize: 11 }} onClick={handleAddResource}>
          {t('addResource')}
        </button>

        {/* Task Markers placeholder */}
        {section('Task Markers')}
        <button className="gantt-btn" style={{ fontSize: 11 }}>
          + Add marker
        </button>

        {/* Notes */}
        {section(t('notes'))}
        <textarea
          className="gantt-input"
          rows={3}
          value={form.notes ?? ''}
          onChange={e => patch('notes', e.target.value)}
          style={{ resize: 'vertical' }}
        />
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--gantt-border)', display: 'flex', gap: 6 }}>
        <button className="gantt-btn primary" style={{ flex: 1 }} onClick={closePanel}>
          {t('save')}
        </button>
        <button
          className="gantt-btn danger"
          onClick={() => { deleteTask(task.id); closePanel(); }}
        >
          {t('delete')}
        </button>
      </div>
    </div>
  );
};

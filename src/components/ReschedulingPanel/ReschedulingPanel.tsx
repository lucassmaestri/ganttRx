import React, { useMemo, useState } from 'react';
import { useGanttStore } from '../../store/ganttStore';
import { analyzeRescheduling } from '../../lib/ganttUtils';
import { format } from 'date-fns';

interface Props {
  onClose: () => void;
}

export const ReschedulingPanel: React.FC<Props> = ({ onClose }) => {
  const tasks = useGanttStore(s => s.tasks);
  const applyRescheduling = useGanttStore(s => s.applyRescheduling);

  const suggestions = useMemo(() => analyzeRescheduling(tasks), [tasks]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(suggestions.map(s => s.taskId)));

  const toggleSel = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleApply = () => {
    const toApply = suggestions.filter(s => selected.has(s.taskId));
    applyRescheduling(toApply);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        background: '#13131a',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        width: 640,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#a855f7', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              ⚡ Análise de Reagendamento
            </div>
            <div style={{ color: '#e2e2f0', fontSize: 14, fontWeight: 600, marginTop: 2 }}>
              {suggestions.length} {suggestions.length === 1 ? 'tarefa precisa' : 'tarefas precisam'} de ajuste
            </div>
          </div>
          <button className="gantt-btn" onClick={onClose} style={{ padding: '3px 10px' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {suggestions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b6b8a' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 13 }}>Todas as tarefas estão dentro do prazo esperado.</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ width: 28, padding: '6px 8px', textAlign: 'left', color: '#6b6b8a', fontWeight: 600 }}></th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#6b6b8a', fontWeight: 600 }}>TAREFA</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', color: '#6b6b8a', fontWeight: 600, width: 100 }}>FIM ATUAL</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', color: '#6b6b8a', fontWeight: 600, width: 100 }}>FIM SUGERIDO</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', color: '#6b6b8a', fontWeight: 600, width: 60 }}>ATRASO</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#6b6b8a', fontWeight: 600 }}>MOTIVO</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map(sug => (
                  <tr
                    key={sug.taskId}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: selected.has(sug.taskId) ? 'rgba(168,85,247,0.08)' : 'transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleSel(sug.taskId)}
                  >
                    <td style={{ padding: '7px 8px' }}>
                      <input
                        type="checkbox"
                        checked={selected.has(sug.taskId)}
                        onChange={() => toggleSel(sug.taskId)}
                        style={{ accentColor: '#a855f7', cursor: 'pointer' }}
                        onClick={e => e.stopPropagation()}
                      />
                    </td>
                    <td style={{ padding: '7px 8px', color: '#e2e2f0', fontWeight: 500 }}>
                      {sug.taskName}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'center', color: '#6b6b8a' }}>
                      {format(sug.currentEnd, 'dd/MM/yy')}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'center', color: '#22c55e', fontWeight: 600 }}>
                      {format(sug.suggestedEnd, 'dd/MM/yy')}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                      <span style={{
                        background: 'rgba(239,68,68,0.15)',
                        color: '#ef4444',
                        borderRadius: 4,
                        padding: '2px 6px',
                        fontSize: 11,
                        fontWeight: 600,
                      }}>
                        +{sug.delayDays}d
                      </span>
                    </td>
                    <td style={{ padding: '7px 8px', color: '#8a8aaa', fontSize: 11 }}>
                      {sug.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {suggestions.length > 0 && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ flex: 1, color: '#6b6b8a', fontSize: 11 }}>
              {selected.size} de {suggestions.length} selecionadas
            </span>
            <button className="gantt-btn" onClick={() => setSelected(new Set(suggestions.map(s => s.taskId)))}>
              Selecionar todas
            </button>
            <button className="gantt-btn" onClick={() => setSelected(new Set())}>
              Limpar
            </button>
            <button
              className="gantt-btn primary"
              onClick={handleApply}
              disabled={selected.size === 0}
              style={{ opacity: selected.size === 0 ? 0.5 : 1 }}
            >
              Aplicar {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

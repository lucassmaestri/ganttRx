import { useEffect, useState } from 'react';
import { GanttChart } from './components/GanttChart/GanttChart';
import { useGanttStore } from './store/ganttStore';
import { mockTasks, mockDependencies, mockResources, generate3kData } from './data/mockData';
import './index.css';

function App() {
  const setTasks        = useGanttStore(s => s.setTasks);
  const setDependencies = useGanttStore(s => s.setDependencies);
  const setResources    = useGanttStore(s => s.setResources);
  const [mode, setMode] = useState<'demo' | '3k'>('demo');

  useEffect(() => {
    if (mode === 'demo') {
      setTasks(mockTasks);
      setDependencies(mockDependencies);
      setResources(mockResources);
    } else {
      const { tasks, dependencies, resources } = generate3kData();
      setTasks(tasks);
      setDependencies(dependencies);
      setResources(resources);
    }
  }, [mode, setTasks, setDependencies, setResources]);

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Demo control bar — sits in normal flow, never overlaps the side panel */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        background: '#0d0d18',
        borderBottom: '1px solid rgba(168,85,247,0.2)',
        flexShrink: 0,
      }}>
        <span style={{ color: '#a855f7', fontSize: 11, fontWeight: 800, letterSpacing: 1, marginRight: 6 }}>
          GanttRx
        </span>
        <button
          className={`gantt-btn ${mode === 'demo' ? 'active' : ''}`}
          style={{ fontSize: 10 }}
          onClick={() => setMode('demo')}
        >
          Demo
        </button>
        <button
          className={`gantt-btn ${mode === '3k' ? 'active' : ''}`}
          style={{ fontSize: 10 }}
          onClick={() => setMode('3k')}
        >
          Stress Test (3k)
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ color: '#4a4a6a', fontSize: 10 }}>
          {mode === 'demo' ? '39 items · 39 deps · 28 resources' : '3 000 tasks · ~2 600 deps'}
        </span>
      </div>

      {/* GanttChart fills remaining height */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <GanttChart />
      </div>
    </div>
  );
}

export default App;

import { useEffect, useState } from 'react';
import { GanttChart } from './components/GanttChart/GanttChart';
import { useGanttStore } from './store/ganttStore';
import { mockTasks, mockDependencies, mockResources, generate3kData } from './data/mockData';
import './index.css';

function App() {
  const setTasks       = useGanttStore(s => s.setTasks);
  const setDependencies = useGanttStore(s => s.setDependencies);
  const setResources   = useGanttStore(s => s.setResources);
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
  }, [mode]);

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Dataset toggle */}
      <div style={{
        position: 'fixed', bottom: 12, right: 12, zIndex: 200,
        display: 'flex', gap: 4,
      }}>
        <button
          className={`gantt-btn ${mode === 'demo' ? 'active' : ''}`}
          style={{ fontSize: 10 }}
          onClick={() => setMode('demo')}
        >
          Demo (28)
        </button>
        <button
          className={`gantt-btn ${mode === '3k' ? 'active' : ''}`}
          style={{ fontSize: 10 }}
          onClick={() => setMode('3k')}
        >
          Stress Test (3k)
        </button>
      </div>
      <GanttChart />
    </div>
  );
}

export default App;

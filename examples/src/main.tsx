import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import Controlled from '../useForm/controlled/App';
import Uncontrolled from '../useForm/uncontrolled/App';
import Kernel from '../kernel/App';
import KernelWorker from '../kernel/worker/App';
import BackendSync from '../backend-sync/App';
import Validation from '../validation/App';
import Perf from '../perf/App';

const el = document.getElementById('root')!;
const root = ReactDOM.createRoot(el);

function pick(which: string) {
  switch (which) {
    case 'controlled':
      return Controlled;
    case 'kernel-worker':
      return KernelWorker;
    case 'kernel':
      return Kernel;
    case 'backend-sync':
      return BackendSync;
    case 'validation':
      return Validation;
    case 'perf':
      return Perf;
    case 'uncontrolled':
    default:
      return Uncontrolled;
  }
}

function AppShell() {
  const [which, setWhich] = React.useState((location.hash.replace('#', '') || 'uncontrolled').toLowerCase());
  React.useEffect(() => {
    const onHash = () => setWhich((location.hash.replace('#', '') || 'uncontrolled').toLowerCase());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const App = pick(which);
  return (
    <div className="container">
      <h2 style={{ margin: 0 }}>react-zustand-form examples</h2>
      <div className="nav">
        <a href="#uncontrolled" className={which === 'uncontrolled' ? 'active' : ''}>uncontrolled</a>
        <a href="#controlled" className={which === 'controlled' ? 'active' : ''}>controlled</a>
        <a href="#kernel" className={which === 'kernel' ? 'active' : ''}>kernel</a>
        <a href="#kernel-worker" className={which === 'kernel-worker' ? 'active' : ''}>kernel-worker</a>
        <a href="#backend-sync" className={which === 'backend-sync' ? 'active' : ''}>backend-sync</a>
        <a href="#perf" className={which === 'perf' ? 'active' : ''}>perf (5k fields)</a>
        <a href="#validation" className={which === 'validation' ? 'active' : ''}>validation (zod/ajv)</a>
      </div>
      <div className="card">
        <App />
      </div>
    </div>
  );
}

root.render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>
);

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
import Mega from '../mega/App';
import RhfMega from '../rhf-mega/App';
import FormikMega from '../formik-mega/App';
import About from '../about/App';
import PerfBattle from '../perf-battle/App';

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
    case 'mega':
      return Mega;
    case 'rhf-mega':
      return RhfMega;
    case 'formik-mega':
      return FormikMega;
    case 'perf-battle':
      return PerfBattle;
    case 'about':
      return About;
    case 'uncontrolled':
    default:
      return Uncontrolled;
  }
}

function AppShell() {
  const [which, setWhich] = React.useState((location.hash.replace('#', '') || 'about').toLowerCase());
  React.useEffect(() => {
    const onHash = () => setWhich((location.hash.replace('#', '') || 'about').toLowerCase());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const App = pick(which);
  return (
    <div className="container">
      <div className="topbar">
        <h2 style={{ margin: 0 }}>react-zustand-form examples</h2>
        <a className="badge" href="https://www.npmjs.com/package/react-zustand-form" target="_blank" rel="noreferrer" title="npm weekly downloads">
          <img alt="npm downloads" src="https://img.shields.io/npm/dw/react-zustand-form?label=downloads%2Fweek&logo=npm&color=cb0000" />
        </a>
      </div>
      <div className="nav">
        <a href="#about" className={which === 'about' ? 'active' : ''}>About</a>
        <a href="#uncontrolled" className={which === 'uncontrolled' ? 'active' : ''}>Uncontrolled</a>
        <a href="#controlled" className={which === 'controlled' ? 'active' : ''}>Controlled</a>
        <a href="#kernel" className={which === 'kernel' ? 'active' : ''}>Kernel</a>
        <a href="#kernel-worker" className={which === 'kernel-worker' ? 'active' : ''}>Kernel + worker</a>
        <a href="#backend-sync" className={which === 'backend-sync' ? 'active' : ''}>Backend sync</a>
        <a href="#validation" className={which === 'validation' ? 'active' : ''}>Validation (Zod/AJV)</a>
        <span className="nav-break" />
        <a href="#perf-battle" className={which === 'perf-battle' ? 'active' : ''}>Perf battle</a>
        <a href="#perf" className={which === 'perf' ? 'active' : ''}>Perf (5k grid)</a>
        <a href="#mega" className={which === 'mega' ? 'active' : ''}>RZF mega (10k)</a>
        <a href="#rhf-mega" className={which === 'rhf-mega' ? 'active' : ''}>RHF mega (10k)</a>
        <a href="#formik-mega" className={which === 'formik-mega' ? 'active' : ''}>Formik mega (10k)</a>

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

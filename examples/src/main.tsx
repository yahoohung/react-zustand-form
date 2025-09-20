import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

import Controlled from '../useForm/controlled/App';
import Uncontrolled from '../useForm/uncontrolled/App';
import Kernel from '../kernel/App';
import KernelWorker from '../kernel/worker/App';
import BackendSync from '../backend-sync/App';
import Validation from '../validation/App';
import Sudoku from '../sudoku/App';
import Game2048 from '../game2048/App';
import Perf from '../perf/App';
import Mega from '../mega/App';
import RhfMega from '../rhf-mega/App';
import FormikMega from '../formik-mega/App';
import PerfBattle from '../perf-battle/App';
import SweetStateMega from '../sweet-state-mega/App';

const demos = [
  {
    id: 'uncontrolled',
    title: 'Uncontrolled form',
    blurb: 'Minimal setup for user-first forms with live meta tracking.',
    component: Uncontrolled,
    tags: ['forms', 'basics'],
    source: 'useForm/uncontrolled',
  },
  {
    id: 'controlled',
    title: 'Controlled form',
    blurb: 'Store-backed inputs with async validation on every keystroke.',
    component: Controlled,
    tags: ['forms'],
    source: 'useForm/controlled',
  },
  {
    id: 'kernel',
    title: 'Kernel (table state)',
    blurb: 'Row × column state with indexes, diff bus, and server sync.',
    component: Kernel,
    tags: ['kernel', 'table'],
    source: 'kernel',
  },
  {
    id: 'kernel-worker',
    title: 'Kernel + worker',
    blurb: 'Column indexing offloaded to a Web Worker for heavy datasets.',
    component: KernelWorker,
    tags: ['kernel', 'performance'],
    source: 'kernel/worker',
  },
  {
    id: 'backend-sync',
    title: 'Backend sync',
    blurb: 'Diff batching, retries, and keep-dirty merges for server round-trips.',
    component: BackendSync,
    tags: ['sync', 'kernel'],
    source: 'backend-sync',
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    blurb: '9×9 puzzle showcasing field, row, column, and box selectors.',
    component: Sudoku,
    tags: ['games', 'kernel'],
    source: 'sudoku',
  },
  {
    id: '2048',
    title: '2048',
    blurb: 'Animated grid with tile-level subscriptions and worker-ready logic.',
    component: Game2048,
    tags: ['games', 'kernel'],
    source: 'game2048',
  },
  {
    id: 'validation',
    title: 'Validation (Zod/AJV)',
    blurb: 'Plug your favourite schema into the resolver contract.',
    component: Validation,
    tags: ['forms', 'validation'],
    source: 'validation',
  },
  {
    id: 'perf',
    title: 'Perf (5k grid)',
    blurb: 'Selector-driven grid with FPS meter for 5,000 inputs.',
    component: Perf,
    tags: ['performance'],
    source: 'perf',
  },
  {
    id: 'mega',
    title: 'rezend-form 10k',
    blurb: '10,000 input stress test with dirty tracking and server merges.',
    component: Mega,
    tags: ['performance'],
    source: 'mega',
  },
  {
    id: 'rhf-mega',
    title: 'react-hook-form 10k',
    blurb: 'Baseline performance for react-hook-form (10k inputs).',
    component: RhfMega,
    tags: ['performance', 'comparison'],
    source: 'rhf-mega',
  },
  {
    id: 'sweet-state-mega',
    title: 'react-sweet-state 10k',
    blurb: 'Grid powered by react-sweet-state with the same stress settings.',
    component: SweetStateMega,
    tags: ['performance', 'comparison'],
    source: 'sweet-state-mega',
  },
  {
    id: 'formik-mega',
    title: 'Formik 10k',
    blurb: 'Formik’s approach to the same 10k grid for comparison.',
    component: FormikMega,
    tags: ['performance', 'comparison'],
    source: 'formik-mega',
  },
];

const el = document.getElementById('root')!;
const root = ReactDOM.createRoot(el);

function useRemoteBadge(url: string, fallback: string) {
  const [value, setValue] = React.useState(fallback);
  React.useEffect(() => {
    let ignore = false;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (ignore) return;
        if ('downloads' in data) {
          const downloads = Number(data.downloads).toLocaleString();
          setValue(`${downloads}/week`);
        }
        if ('stargazers_count' in data) {
          const stars = Number(data.stargazers_count).toLocaleString();
          setValue(`${stars}★`);
        }
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [url]);
  return value;
}

function HeroBadges() {
  const downloads = useRemoteBadge(
    'https://api.npmjs.org/downloads/point/last-week/rezend-form',
    '—'
  );
  const stars = useRemoteBadge('https://api.github.com/repos/yahoohung/rezend-form', '—');

  return (
    <div className="hero-badges">
      <a
        className="hero-badge"
        href="https://www.npmjs.com/package/rezend-form"
        target="_blank"
        rel="noreferrer"
      >
        <span className="badge-label">npm downloads</span>
        <span className="badge-value">{downloads}</span>
      </a>
      <a
        className="hero-badge"
        href="https://github.com/yahoohung/rezend-form"
        target="_blank"
        rel="noreferrer"
      >
        <span className="badge-label">GitHub stars</span>
        <span className="badge-value">{stars}</span>
      </a>
      <a
        className="hero-badge"
        href="https://github.com/yahoohung/rezend-form"
        target="_blank"
        rel="noreferrer"
      >
        <span className="badge-label">GitHub</span>
        <span className="badge-value">View repo →</span>
      </a>
    </div>
  );
}

function FeatureHighlights() {
  const features = [
    {
      title: 'Kernel-powered state',
      description:
        'Model complex grids and forms with ActionGate, diff bus, and column indexes that stay in sync by design.',
      emoji: '🧠',
    },
    {
      title: 'Scoped subscriptions',
      description:
        'Cells, rows, columns, and boxes re-render independently. Perfect for high-FPS experiences.',
      emoji: '🎯',
    },
    {
      title: 'Worker ready',
      description:
        'Toggle `offloadToWorker` to push indexing off the main thread—no refactor required.',
      emoji: '🚀',
    },
    {
      title: 'Tiny runtime',
      description:
        'Tree-shakeable build with no React context overhead. Stay under 9 kB gzipped.',
      emoji: '🪶',
    },
  ];

  return (
    <section className="section" id="highlights">
      <div className="section-header">
        <h2>Why developers pick rezend-form</h2>
        <p>Architected for React 18/19 concurrent apps that need ultra-fast state updates.</p>
      </div>
      <div className="feature-grid">
        {features.map((feature) => (
          <article key={feature.title} className="feature-card">
            <span className="feature-icon" aria-hidden="true">{feature.emoji}</span>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

type DemoId = (typeof demos)[number]['id'];

function ExamplesGallery({ onSelect }: { onSelect: (id: DemoId) => void }) {
  return (
    <section className="section" id="examples">
      <div className="section-header">
        <h2>Explore the interactive examples</h2>
        <p>Open any demo to inspect the code, tweak behavior, and learn the patterns.</p>
      </div>
      <div className="example-grid">
        {demos.map((demo) => (
          <article key={demo.id} className="example-card">
            <div className="card-top">
              <h3>{demo.title}</h3>
              <div className="tag-row">
                {demo.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </div>
            <p>{demo.blurb}</p>
            <footer>
              <button type="button" onClick={() => onSelect(demo.id)}>Open in playground</button>
              <a href={`https://github.com/yahoohung/rezend-form/tree/main/examples/${demo.source ?? demo.id}`}>Source ↗</a>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

function PerformanceShowcase({ onSelect }: { onSelect: (id: DemoId) => void }) {
  return (
    <section className="section" id="battle">
      <div className="section-header">
        <h2>Performance battle: rezend-form vs others</h2>
        <p>
          Slide between the 10k-field stress tests powered by rezend-form, react-hook-form, and
          Formik. Even on low-specced devices you can feel how the kernel keeps typing and scrolling
          fluid while the baselines noticeably hitch.
        </p>
      </div>
      <div className="card battle-card">
        <PerfBattle onSelect={onSelect} />
      </div>
    </section>
  );
}

function GettingStarted() {
  return (
    <section className="section" id="getting-started">
      <div className="section-header">
        <h2>Get started in 60 seconds</h2>
        <p>Install the library, wire an ActionGate, and start receiving diff events.</p>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <pre>
          <code>{`pnpm add rezend-form

import { createFormKernel } from 'rezend-form';

const kernel = createFormKernel({
  r1: { c1: 'Ada', c2: 'ada@example.com' }
});

kernel.gate.updateField('rows.r1.c1', 'Grace');
kernel.diffBus.subscribe((batch) => console.log(batch));`}</code>
        </pre>
      </div>
    </section>
  );
}

function ApiGuide() {
  const topics = [
    {
      title: 'createFormKernel(rows, options)',
      detail: 'Spin up a kernel with ActionGate, diff bus, version map, and optional worker indexing.',
    },
    {
      title: 'useForm<T>(config)',
      detail: 'High-level hook for React forms with resolver support and field registration helpers.',
    },
    {
      title: 'ActionGate',
      detail: 'Batched updates with undo/redo hooks, dirty tracking, and server merge helpers.',
    },
    {
      title: 'Plugins',
      detail: 'Drop-in helpers like backend sync, DOM reset sync, and more via `rezend-form/plugins`.',
    },
    {
      title: 'Diff bus & version map',
      detail: 'Subscribe to granular change events, inspect columns/rows, and power devtools.',
    },
  ];

  return (
    <section className="section" id="api">
      <div className="section-header">
        <h2>API guide at a glance</h2>
        <p>Head to the README for the full reference, or start with these building blocks.</p>
      </div>
      <div className="api-grid">
        {topics.map((topic) => (
          <article key={topic.title} className="api-card">
            <h3>{topic.title}</h3>
            <p>{topic.detail}</p>
          </article>
        ))}
      </div>
      <div className="cta-row">
        <a className="cta" href="https://github.com/yahoohung/rezend-form#readme" target="_blank" rel="noreferrer">
          Read full documentation ↗
        </a>
        <a className="cta ghost" href="https://codesandbox.io/p/sandbox/rezend-form-starter" target="_blank" rel="noreferrer">
          Try the starter sandbox ↗
        </a>
      </div>
    </section>
  );
}

function useDemoFromHash(initial: DemoId): [DemoId, (id: DemoId) => void] {
  const [active, setActive] = React.useState<DemoId>(() => {
    const hash = new URL(window.location.href).hash.replace('#', '').trim();
    if (hash.startsWith('demo=')) {
      const id = hash.slice('demo='.length) as DemoId;
      return demos.find((demo) => demo.id === id)?.id ?? initial;
    }
    return initial;
  });

  const set = React.useCallback((id: DemoId) => {
    setActive(id);
    const url = new URL(window.location.href);
    url.hash = `demo=${id}`;
    history.replaceState(null, '', url.toString());
  }, []);

  React.useEffect(() => {
    const onHashChange = () => {
      const url = new URL(window.location.href);
      const hash = url.hash.replace('#', '');
      if (hash.startsWith('demo=')) {
        const id = hash.slice('demo='.length) as DemoId;
        if (demos.some((demo) => demo.id === id)) setActive(id);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return [active, set];
}

function Playground({ activeDemo, setActiveDemo }: { activeDemo: DemoId; setActiveDemo: (id: DemoId) => void }) {
  const DemoComponent = React.useMemo(() => demos.find((d) => d.id === activeDemo)?.component ?? Mega, [activeDemo]);

  return (
    <section className="section" id="playground">
      <div className="section-header">
        <h2>Live playground</h2>
        <p>Select a demo to mount it inline. Open the source to copy/paste into your app.</p>
      </div>
      <div className="playground">
        <aside>
          <ul>
            {demos.map((demo) => (
              <li key={demo.id}>
                <button
                  className={demo.id === activeDemo ? 'active' : ''}
                  onClick={() => setActiveDemo(demo.id)}
                >
                  {demo.title}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div className="playground-preview">
          <DemoComponent />
        </div>
      </div>
    </section>
  );
}

function App() {
  const [activeDemo, setActiveDemo] = useDemoFromHash('mega');
  const scrollToPlayground = React.useCallback(() => {
    requestAnimationFrame(() => {
      const el = document.getElementById('playground');
      if (!el) return;
      const nav = document.querySelector('.site-nav');
      const navHeight = nav ? (nav as HTMLElement).getBoundingClientRect().height : 0;
      const top = el.getBoundingClientRect().top + window.scrollY - navHeight - 24;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
  }, []);

  return (
    <div className="app-shell">
      <nav className="site-nav">
        <a href="#top" className="logo">rezend-form</a>
        <div className="nav-links">
          <a href="#examples">Examples</a>
          <a href="#battle">Performance</a>
          <a href="#playground">Playground</a>
          <a href="#getting-started">Getting started</a>
          <a href="#api">API</a>
          <a href="https://github.com/yahoohung/rezend-form" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="hero-copy">
          <p className="hero-kicker">State toolkit for ambitious React teams</p>
          <h1>Simple APIs. Instant updates. Always in sync.</h1>
          <p className="hero-sub">
            Try the live 2048 kernel on the right—tiles move with field-level selectors while row and
            column watchers keep everything honest.
          </p>
          <div className="hero-cta">
            <a className="cta" href="#getting-started">Start in 60 seconds</a>
            <a className="cta ghost" href="#examples">See live examples</a>
          </div>
          <HeroBadges />
        </div>
        <div className="hero-demo">
          <Game2048 compact />
        </div>
      </header>

      <main>
        <FeatureHighlights />
        <ExamplesGallery
          onSelect={(id) => {
            setActiveDemo(id);
            scrollToPlayground();
          }}
        />
        <PerformanceShowcase onSelect={(id) => {
          setActiveDemo(id as DemoId);
          scrollToPlayground();
        }} />
        <Playground activeDemo={activeDemo} setActiveDemo={setActiveDemo} />
        <GettingStarted />
        <ApiGuide />
      </main>

      <footer className="site-footer">
        <div>
          <strong>rezend-form</strong>
          <p>Tiny, concurrent-safe state for ambitious React applications.</p>
        </div>
        <div className="footer-links">
          <a href="https://github.com/yahoohung/rezend-form" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://www.npmjs.com/package/rezend-form" target="_blank" rel="noreferrer">npm</a>
          <a href="https://github.com/yahoohung/rezend-form/blob/main/CHANGELOG.md" target="_blank" rel="noreferrer">Changelog</a>
          <a href="https://twitter.com/share?text=Check%20out%20rezend-form&url=https://github.com/yahoohung/rezend-form" target="_blank" rel="noreferrer">Share</a>
        </div>
        <span className="footer-meta">MIT © {new Date().getFullYear()} rezend-form</span>
      </footer>
    </div>
  );
}

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

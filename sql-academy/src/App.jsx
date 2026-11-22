import { useEffect, useMemo, useState } from 'react';
import { ConceptPage } from './components/ConceptPage';
import { Courses } from './components/Courses';
import { Home } from './components/Home';
import { Sidebar } from './components/Sidebar';
import { conceptById } from './content';
import { getDb, resetDb } from './db';

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('sql-academy-theme'); } catch { return null; }
  });
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    try { theme ? localStorage.setItem('sql-academy-theme', theme) : localStorage.removeItem('sql-academy-theme'); } catch { /* ignore */ }
  }, [theme]);
  const toggle = () => {
    const dark = theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(dark ? 'light' : 'dark');
  };
  return toggle;
}

export function App() {
  const hash = useHashRoute();
  const toggleTheme = useTheme();
  const [dbState, setDbState] = useState('loading');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    getDb().then(() => setDbState('ready'), (e) => setDbState(`error: ${e.message}`));
  }, []);

  const route = useMemo(() => {
    if (hash === '#/courses') return { page: 'courses' };
    const m = /^#\/c\/([a-z0-9-]+)/.exec(hash);
    return m && conceptById[m[1]] ? { page: 'concept', concept: conceptById[m[1]] } : { page: 'home' };
  }, [hash]);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
    document.title = route.page === 'concept' ? `${route.concept.title} · SQL Academy`
      : route.page === 'courses' ? 'SQL courses · SQL Academy' : 'SQL Academy';
  }, [route]);

  const reset = async () => {
    setDbState('loading');
    await resetDb();
    setDbState('reset');
    setTimeout(() => setDbState('ready'), 1500);
  };

  const hue = route.page === 'concept' ? route.concept.chapter.hue : 265;

  return (
    <div className={`app ${menuOpen ? 'menu-open' : ''}`} style={{ '--hue': hue }}>
      <header className="topbar">
        <button className="icon-btn menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Chapters">☰</button>
        <a href="#/" className="logo"><span className="logo-mark">SQL</span> Academy</a>
        <a href="#/courses" className={`top-link ${route.page === 'courses' ? 'active' : ''}`}>Courses</a>
        <span className={`db-status ${dbState.startsWith('error') ? 'bad' : ''}`} title="PostgreSQL running in your browser">
          <span className="dot" /> {dbState === 'loading' ? 'Starting PostgreSQL…' : dbState === 'reset' ? 'Data restored' : dbState.startsWith('error') ? dbState : 'PostgreSQL ready'}
        </span>
        <button className="ghost" onClick={reset} title="Rebuild the practice database from scratch">Reset data</button>
        <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle dark mode">◐</button>
      </header>
      <Sidebar current={route.page === 'concept' ? route.concept.id : null} />
      <main className="content">
        {route.page === 'concept' ? <ConceptPage key={route.concept.id} concept={route.concept} />
          : route.page === 'courses' ? <Courses /> : <Home />}
      </main>
    </div>
  );
}

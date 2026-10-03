import { lazy, Suspense, useEffect, useState } from 'react';
import { onAuthChange, restoreSession, signOut } from './lib/api.js';
import { useUserData } from './hooks/useUserData.js';
import Login from './components/Login.jsx';
import Tracker from './components/Tracker.jsx';
import Courses from './components/Courses.jsx';
import Devices from './components/Devices.jsx';
import Account from './components/Account.jsx';
import Privacy from './components/Privacy.jsx';
// The editor (TipTap + KaTeX) is large, so it only downloads when Notes is opened.
const Notes = lazy(() => import('./components/notes/Notes.jsx'));

const TABS = [
  ['tracker', '100 days'],
  ['notes', 'Notes'],
  ['courses', 'Courses'],
  ['devices', 'Connected devices'],
  ['account', 'Account'],
];

// Routes look like #/courses or #/login?error=...
function parseHash() {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  return { page: path || 'tracker', params: new URLSearchParams(query) };
}

function useHashRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export default function App() {
  const route = useHashRoute();
  const [signedIn, setSignedIn] = useState(undefined);

  useEffect(() => {
    const off = onAuthChange(setSignedIn);
    restoreSession().then(setSignedIn);
    return off;
  }, []);

  if (route.page === 'privacy') return <Shell><Privacy /></Shell>;
  if (signedIn === undefined) return <Shell><p className="muted">Loading…</p></Shell>;
  if (!signedIn) return <Shell><Login initialError={oauthError(route)} /></Shell>;
  return <SignedIn page={route.page} />;
}

function oauthError(route) {
  const code = route.page === 'login' ? route.params.get('error') : null;
  if (!code) return null;
  return code === 'cancelled' ? 'Google sign-in was cancelled.' : 'Google sign-in failed or expired. Please try again.';
}

function SignedIn({ page: requested }) {
  const data = useUserData();
  const [base, sub] = requested.split('/'); // e.g. notes/<page id>
  const page = TABS.some(([id]) => id === base) ? base : 'tracker';

  return (
    <Shell
      nav={
        <nav className="tabs" aria-label="Sections">
          {TABS.map(([id, label]) => (
            <a key={id} href={`#/${id}`} className={page === id ? 'active' : undefined} aria-current={page === id ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>
      }
      user={data.profile?.email}
    >
      {data.error && (
        <div className="banner error" role="alert">
          {data.error} <button className="link" onClick={data.clearError}>Dismiss</button>
        </div>
      )}
      {data.loading || !data.profile ? (
        <p className="muted">Loading your progress…</p>
      ) : (
        <>
          {page === 'tracker' && <Tracker data={data} />}
          {page === 'notes' && (
            <Suspense fallback={<p className="muted">Loading editor…</p>}>
              <Notes noteId={sub} />
            </Suspense>
          )}
          {page === 'courses' && <Courses data={data} />}
          {page === 'devices' && <Devices data={data} />}
          {page === 'account' && <Account data={data} />}
        </>
      )}
    </Shell>
  );
}

function Shell({ children, nav, user }) {
  return (
    <div className="app">
      <header className="top">
        <a href="#/tracker" className="brand"><span className="logo">100</span> DE100 Tracker</a>
        {user && (
          <div className="who">
            <span className="muted">{user}</span>
            <button className="ghost" onClick={signOut}>Sign out</button>
          </div>
        )}
      </header>
      {nav}
      <main>{children}</main>
      <footer className="muted"><a href="#/privacy">Privacy</a></footer>
    </div>
  );
}

import { useState } from 'react';
import { api, signOut } from '../lib/api.js';
import { timeAgo } from './Courses.jsx';

export default function Devices({ data }) {
  const { sessions, revokeSession, reload } = data;
  const [msg, setMsg] = useState(null);

  async function signOutOthers() {
    try {
      const { revoked } = await api('/sessions/revoke-others', { method: 'POST' });
      setMsg({ kind: 'ok', text: `Signed out ${revoked} other session${revoked === 1 ? '' : 's'}.` });
      reload();
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    }
  }

  function disconnect(s) {
    if (!window.confirm(s.current ? 'Sign out of this browser?' : `Disconnect "${s.name}"? It loses access immediately.`)) return;
    if (s.current) signOut();
    else revokeSession(s.id);
  }

  const extensions = sessions.filter((s) => s.kind === 'extension');

  return (
    <section className="card">
      <h1>Connected devices</h1>
      <p className="muted">
        Every browser and Chrome extension signed in to your account. Disconnecting one revokes its access at once.
        The extension reads only course titles and percentages from Udemy; it never sees your Udemy password.
      </p>
      {extensions.length === 0 && <p className="banner">No Chrome extension connected yet. Install it and sign in with this account.</p>}

      <ul className="devices">
        {sessions.map((s) => (
          <li key={s.id}>
            <div>
              <strong>{s.name}</strong>{' '}
              <span className={`pill ${s.kind === 'extension' ? 'ext' : ''}`}>{s.kind === 'extension' ? 'Extension' : 'Web'}</span>
              {s.current && <span className="pill">This browser</span>}
              <div className="muted small">Signed in {timeAgo(s.createdAt)} · last active {timeAgo(s.lastUsedAt)}</div>
            </div>
            <button className="danger" onClick={() => disconnect(s)}>{s.current ? 'Sign out' : 'Disconnect'}</button>
          </li>
        ))}
      </ul>

      <h2>Lost a device?</h2>
      <p className="muted small">Sign out everywhere except this browser.</p>
      <button className="secondary" onClick={signOutOthers} disabled={sessions.length < 2}>Sign out all other sessions</button>
      {msg && <p className={`banner ${msg.kind}`} role="status">{msg.text}</p>}
    </section>
  );
}

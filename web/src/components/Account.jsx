import { useState } from 'react';
import { api, changePassword, signOutLocally } from '../lib/api.js';

function PasswordSection({ hasPassword }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (next !== confirm) return setMsg({ kind: 'error', text: "New passwords don't match" });
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent(''); setNext(''); setConfirm('');
      setMsg({ kind: 'ok', text: 'Password changed. Your other sessions (including the extension) were signed out.' });
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>{hasPassword ? 'Change password' : 'Set a password'}</h2>
      <form className="stack narrow-form" onSubmit={submit}>
        {hasPassword && (
          <label>
            Current password
            <input type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
        )}
        <label>
          New password
          <input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        <label>
          Confirm new password
          <input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
        {msg && <p className={`banner ${msg.kind}`} role="status">{msg.text}</p>}
      </form>
    </section>
  );
}

export default function Account({ data }) {
  const { profile, saveProfile } = data;
  const [name, setName] = useState(profile.displayName ?? '');
  const [start, setStart] = useState(profile.startDate);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaved(await saveProfile({ displayName: name.trim() || null, startDate: start }));
  }

  async function exportData() {
    try {
      const payload = await api('/me/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `de92-export-${payload.exportedAt.slice(0, 10)}.json` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      await api('/me', { method: 'DELETE' });
      signOutLocally();
    } catch (err) {
      setBusy(false);
      alert(err.message);
    }
  }

  return (
    <>
      <section className="card">
        <h1>Account</h1>
        <p className="muted small">{profile.email}</p>
        <form className="stack narrow-form" onSubmit={save}>
          <label>
            Display name
            <input value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
          </label>
          <label>
            Program start date (Day 1)
            <input type="date" required value={start} onChange={(e) => { setStart(e.target.value); setSaved(false); }} />
          </label>
          <button type="submit">Save</button>
          {saved && <p className="banner ok" role="status">Saved.</p>}
        </form>
      </section>

      <PasswordSection hasPassword={profile.hasPassword} />

      <section className="card">
        <h2>Your data</h2>
        <p className="muted">Download everything stored about you as JSON (GDPR data portability).</p>
        <button className="secondary" onClick={exportData}>Export my data</button>
      </section>

      <section className="card danger-zone">
        <h2>Delete account</h2>
        <p className="muted">Permanently deletes your account, progress, notes and connected devices. This can't be undone.</p>
        <label className="stack narrow-form">
          Type DELETE to confirm
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <button className="danger" disabled={confirm !== 'DELETE' || busy} onClick={deleteAccount}>
          {busy ? 'Deleting…' : 'Delete my account and data'}
        </button>
      </section>
    </>
  );
}

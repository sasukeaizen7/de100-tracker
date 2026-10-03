import { useEffect, useState } from 'react';
import { getProviders, googleSignInUrl, login, register } from '../lib/api.js';

export default function Login({ initialError }) {
  const [mode, setMode] = useState('login'); // login | register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [google, setGoogle] = useState(false);

  useEffect(() => { getProviders().then((p) => setGoogle(p.google)); }, []);

  async function submit(e) {
    e.preventDefault();
    if (mode === 'register' && password !== confirm) return setError("Passwords don't match");
    setBusy(true);
    setError(null);
    try {
      if (mode === 'register') await register(email.trim(), password);
      else await login(email.trim(), password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError(null);
    setPassword('');
    setConfirm('');
  }

  const registering = mode === 'register';

  return (
    <section className="card narrow">
      <h1>{registering ? 'Create your account' : 'Sign in'}</h1>
      <p className="muted">Track the 100-day Data Engineering program. The Chrome extension uses this same account.</p>

      <form onSubmit={submit} className="stack">
        <label>
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password" required minLength={registering ? 8 : 1} maxLength={128}
            autoComplete={registering ? 'new-password' : 'current-password'}
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {registering && (
          <label>
            Confirm password
            <input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <span className="muted small">At least 8 characters.</span>
          </label>
        )}
        <button type="submit" disabled={busy}>
          {busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="small switch">
        {registering ? 'Already have an account? ' : 'New here? '}
        <button type="button" className="link" onClick={() => switchMode(registering ? 'login' : 'register')}>
          {registering ? 'Sign in' : 'Create an account'}
        </button>
      </p>

      {google && (
        <>
          <div className="divider"><span>or</span></div>
          <a className="button secondary wide" href={googleSignInUrl}>Continue with Google</a>
        </>
      )}

      {error && <p className="banner error" role="alert">{error}</p>}
      <p className="muted small">By signing in you agree to the <a href="#/privacy">privacy policy</a>.</p>
    </section>
  );
}

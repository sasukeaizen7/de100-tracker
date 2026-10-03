import { API_URL, WEB_APP_URL } from './config.js';

const $ = (id) => document.getElementById(id);

async function call(type, payload = {}) {
  const res = await chrome.runtime.sendMessage({ type, ...payload });
  if (!res?.ok) throw new Error(res?.error || 'Something went wrong');
  return res.data;
}

function say(text, kind = 'info') {
  const el = $('message');
  el.hidden = !text;
  el.textContent = text ?? '';
  el.className = kind;
}

function render(state) {
  $('signed-out').hidden = state.signedIn;
  $('signed-in').hidden = !state.signedIn;
  if (!state.signedIn) return;

  $('who').textContent = state.email;
  $('auto').checked = state.autoSync;
  const last = state.lastSync;
  $('last').textContent = last
    ? `Last sync ${new Date(last.at).toLocaleString()}: ${last.matched.length} of your plan's courses found among ${last.found} Udemy courses.`
    : 'Not synced yet.';
  $('matched').replaceChildren(
    ...(last?.matched ?? []).map((m) => {
      const li = document.createElement('li');
      li.textContent = `${m.percent}% · ${m.udemyTitle}`;
      return li;
    }),
  );
}

// Disable a button while its action runs, and surface errors.
function action(button, fn) {
  return async (e) => {
    e?.preventDefault();
    button.disabled = true;
    say(null);
    try {
      await fn();
    } catch (err) {
      say(err.message, 'error');
    } finally {
      button.disabled = false;
    }
  };
}

$('open-app').href = WEB_APP_URL;
$('signup').href = WEB_APP_URL;

// Show "Continue with Google" only when the API has it configured.
fetch(`${API_URL}/auth/providers`)
  .then((r) => r.json())
  .then((p) => { $('google-block').hidden = !p.google; })
  .catch(() => {});

$('google').addEventListener('click', action($('google'), async () => render(await call('google'))));

$('login-form').addEventListener('submit', action($('login-form').querySelector('button'), async () => {
  const state = await call('login', { email: $('email').value.trim(), password: $('password').value });
  $('password').value = '';
  render(state);
}));

$('sync').addEventListener('click', action($('sync'), async () => {
  $('sync').textContent = 'Syncing…';
  try {
    const state = await call('sync');
    render(state);
    say(state.result ? 'Progress saved to your tracker.' : 'Nothing to sync.', 'ok');
  } finally {
    $('sync').textContent = 'Sync Udemy progress';
  }
}));

$('auto').addEventListener('change', async (e) => {
  try {
    render(await call('setAutoSync', { enabled: e.target.checked }));
  } catch (err) {
    say(err.message, 'error');
  }
});

$('sign-out').addEventListener('click', action($('sign-out'), async () => render(await call('signOut'))));

call('status').then(render, (err) => say(err.message, 'error'));

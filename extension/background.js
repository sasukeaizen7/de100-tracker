// Service worker: owns auth and syncing so a flow survives the popup closing.
import { ApiError, getSession, signInWithGoogle, signInWithPassword, signOut } from './lib/auth.js';
import { syncProgress } from './lib/api.js';
import { readUdemyProgress } from './lib/udemy.js';

const AUTO_ALARM = 'auto-sync';
const MANUAL_COOLDOWN_MS = 60_000;
const AUTO_INTERVAL_MIN = 60;

async function status() {
  const session = await getSession().catch(() => null);
  const { lastSync = null, autoSync = false } = await chrome.storage.local.get(['lastSync', 'autoSync']);
  return { signedIn: Boolean(session), email: session?.email ?? null, lastSync, autoSync };
}

async function afterSignIn() {
  await chrome.storage.local.set({ lastSync: null });
  return status();
}

async function sync({ manual }) {
  if (!(await getSession())) throw new Error('Sign in first.');
  const { lastSync } = await chrome.storage.local.get('lastSync');
  if (manual && lastSync?.at && Date.now() - lastSync.at < MANUAL_COOLDOWN_MS) {
    throw new Error('Synced less than a minute ago. Try again shortly.');
  }

  const udemy = await readUdemyProgress({ openIfNeeded: manual });
  if (udemy.error === 'no_udemy_tab') return null; // auto-sync only runs alongside an open Udemy tab
  if (udemy.error === 'not_logged_in') throw new Error('Sign in to Udemy in this browser, then sync again.');
  if (udemy.error) throw new Error(`Couldn't read Udemy progress (${udemy.error}).`);

  try {
    const { found, matched } = await syncProgress(udemy.items);
    const result = { at: Date.now(), found, matched };
    await chrome.storage.local.set({ lastSync: result });
    return result;
  } catch (err) {
    // 401 after a refresh attempt = this browser was disconnected from the web app.
    if (err instanceof ApiError && err.status === 401) await setAutoSync(false);
    throw err;
  }
}

let syncing = null;
function runSync(opts) {
  syncing ??= sync(opts).finally(() => { syncing = null; });
  return syncing;
}

async function setAutoSync(enabled) {
  await chrome.storage.local.set({ autoSync: enabled });
  if (enabled) await chrome.alarms.create(AUTO_ALARM, { periodInMinutes: AUTO_INTERVAL_MIN });
  else await chrome.alarms.clear(AUTO_ALARM);
  return status();
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_ALARM) runSync({ manual: false }).catch((e) => console.warn('Auto-sync failed:', e.message));
});

const handlers = {
  status,
  google: async () => { await signInWithGoogle(); return afterSignIn(); },
  login: async ({ email, password }) => { await signInWithPassword(email, password); return afterSignIn(); },
  sync: async () => ({ result: await runSync({ manual: true }), ...(await status()) }),
  setAutoSync: ({ enabled }) => setAutoSync(Boolean(enabled)),
  signOut: async () => { await signOut(); return setAutoSync(false); },
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only accept messages from this extension's own pages.
  if (sender.id !== chrome.runtime.id || sender.tab) return false;
  const handler = handlers[msg?.type];
  if (!handler) return false;
  Promise.resolve(handler(msg))
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
  return true; // keep the channel open for the async response
});

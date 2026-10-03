// Reads enrolled courses from Udemy using the tab's existing session.
// The extension never sees the Udemy password or cookies: the request runs
// inside a udemy.com tab, and only titles and percentages come back.

const MY_COURSES_URL = 'https://www.udemy.com/home/my-courses/learning/';

// Injected into a udemy.com tab by chrome.scripting, so it must be self-contained.
// Udemy's internal API is undocumented and may change; adjust the fields here if it does.
async function readProgressInPage() {
  const items = [];
  let url = '/api-2.0/users/me/subscribed-courses/?page_size=100&fields[course]=id,title,completion_ratio';
  for (let page = 0; url && page < 10; page++) {
    const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (res.status === 401 || res.status === 403) return { error: 'not_logged_in' };
    if (!res.ok) return { error: `udemy_http_${res.status}` };
    const data = await res.json();
    for (const c of data.results ?? []) {
      items.push({ udemyId: c.id, title: String(c.title ?? ''), percent: Number(c.completion_ratio ?? 0) });
    }
    url = data.next;
  }
  return { items };
}

function waitForLoad(tabId, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('Udemy took too long to load')); }, timeoutMs);
    const listener = (id, info) => { if (id === tabId && info.status === 'complete') { cleanup(); resolve(); } };
    const cleanup = () => { clearTimeout(timer); chrome.tabs.onUpdated.removeListener(listener); };
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((t) => { if (t.status === 'complete') { cleanup(); resolve(); } }, () => {});
  });
}

// openIfNeeded: for a manual sync, briefly open a background Udemy tab if none is open.
export async function readUdemyProgress({ openIfNeeded }) {
  const [existing] = await chrome.tabs.query({ url: 'https://www.udemy.com/*' });
  let tabId = existing?.id;
  let opened = false;

  if (!tabId) {
    if (!openIfNeeded) return { error: 'no_udemy_tab' };
    tabId = (await chrome.tabs.create({ url: MY_COURSES_URL, active: false })).id;
    opened = true;
    await waitForLoad(tabId);
  }

  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: readProgressInPage });
    if (result.error) return result;
    // Normalize before anything leaves the browser.
    const items = result.items
      .filter((i) => i.title && Number.isFinite(i.percent))
      .map((i) => ({
        ...(Number.isSafeInteger(i.udemyId) && i.udemyId > 0 && { udemyId: i.udemyId }),
        title: i.title.slice(0, 300),
        percent: Math.min(100, Math.max(0, Math.round(i.percent))),
      }))
      .slice(0, 500);
    return { items };
  } finally {
    if (opened) chrome.tabs.remove(tabId).catch(() => {});
  }
}

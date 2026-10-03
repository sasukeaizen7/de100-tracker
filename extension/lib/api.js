// Tracker API calls made by the extension.
import { authedCall } from './auth.js';

// items: [{ udemyId?, title, percent }] -> { found, matched: [{ courseId, percent, udemyTitle }] }
export function syncProgress(items) {
  return authedCall('/sync', { body: { items } });
}

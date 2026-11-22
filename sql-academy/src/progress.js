import { useEffect, useState } from 'react';

// "Learned" flags per concept, kept in this browser only.
const KEY = 'sql-academy-learned';
const listeners = new Set();

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; }
}

let learned = read();

export function setLearned(id, value) {
  learned = { ...learned, [id]: value };
  try { localStorage.setItem(KEY, JSON.stringify(learned)); } catch { /* storage unavailable */ }
  listeners.forEach((fn) => fn(learned));
}

export function useLearned() {
  const [state, setState] = useState(learned);
  useEffect(() => {
    listeners.add(setState);
    return () => listeners.delete(setState);
  }, []);
  return state;
}

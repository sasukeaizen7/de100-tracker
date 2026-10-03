import { useCallback, useEffect, useRef, useState } from 'react';
import { api, signOutLocally, subscribeEvents } from '../lib/api.js';

const index = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r]));

// Loads everything the signed-in user owns and keeps it live: the server pushes
// "something changed" events and we refetch, so progress synced by the extension
// shows up without a refresh.
export function useUserData() {
  const [state, setState] = useState({ loading: true, error: null, profile: null, courses: [], progress: {}, days: {}, sessions: [] });
  const stateRef = useRef(state);
  stateRef.current = state;

  const load = useCallback(async () => {
    try {
      const me = await api('/me');
      setState((s) => ({
        ...s,
        loading: false,
        profile: me.profile,
        courses: me.courses,
        progress: index(me.progress, 'courseId'),
        days: index(me.days, 'day'),
        sessions: me.sessions,
      }));
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    load();
    let timer;
    const stop = subscribeEvents((event) => {
      if (event.type === 'account-deleted') return signOutLocally();
      if (event.type === 'notes') return; // the Notes page handles its own updates
      clearTimeout(timer);
      timer = setTimeout(load, 250); // coalesce bursts (e.g. a sync touching several courses)
    });
    return () => { stop(); clearTimeout(timer); };
  }, [load]);

  const fail = (err) => setState((s) => ({ ...s, error: err.message }));

  // Optimistic updates, rolled back if the server rejects them.
  const saveDay = useCallback(async (day, patch) => {
    const prev = stateRef.current.days[day];
    setState((s) => ({ ...s, days: { ...s.days, [day]: { day, done: false, notes: '', ...prev, ...patch } } }));
    try {
      const row = await api(`/days/${day}`, { method: 'PUT', body: patch });
      setState((s) => ({ ...s, days: { ...s.days, [day]: row } }));
    } catch (err) {
      setState((s) => ({ ...s, days: { ...s.days, [day]: prev } }));
      fail(err);
    }
  }, []);

  const saveProgress = useCallback(async (courseId, percent) => {
    const prev = stateRef.current.progress[courseId];
    setState((s) => ({ ...s, progress: { ...s.progress, [courseId]: { ...prev, courseId, percent, source: 'manual' } } }));
    try {
      const row = await api(`/progress/${courseId}`, { method: 'PUT', body: { percent } });
      setState((s) => ({ ...s, progress: { ...s.progress, [courseId]: row } }));
    } catch (err) {
      setState((s) => ({ ...s, progress: { ...s.progress, [courseId]: prev } }));
      fail(err);
    }
  }, []);

  const saveProfile = useCallback(async (patch) => {
    try {
      const profile = await api('/me', { method: 'PATCH', body: patch });
      setState((s) => ({ ...s, profile }));
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }, []);

  const revokeSession = useCallback(async (id) => {
    try {
      await api(`/sessions/${id}`, { method: 'DELETE' });
      setState((s) => ({ ...s, sessions: s.sessions.filter((x) => x.id !== id) }));
    } catch (err) {
      fail(err);
    }
  }, []);

  const clearError = useCallback(() => setState((s) => ({ ...s, error: null })), []);

  return { ...state, reload: load, saveDay, saveProgress, saveProfile, revokeSession, clearError };
}

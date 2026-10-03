import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import NoteEditor from './NoteEditor.jsx';
import './notes.css';

const ICONS = ['📄', '📘', '📝', '💡', '✅', '📊', '🧮', '🐍', '🗄️', '⚙️', '☁️', '🐳', '🔥', '⭐', '🎯', '📌', '🧠', '🚀', '📷', '🔗'];

// Turn the flat list into a tree ordered by position.
function buildTree(list) {
  const byParent = new Map();
  for (const n of list) {
    const key = n.parentId ?? 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(n);
  }
  return byParent;
}

export default function Notes({ noteId }) {
  const [list, setList] = useState(null);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [query, setQuery] = useState('');

  const loadList = useCallback(async () => {
    try {
      setList(await api('/notes'));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  // Keep the sidebar in sync with changes made in other tabs or devices.
  useEffect(() => {
    let t;
    const onChange = (e) => { if (e.detail?.type === 'notes') { clearTimeout(t); t = setTimeout(loadList, 400); } };
    window.addEventListener('de92-change', onChange);
    return () => { window.removeEventListener('de92-change', onChange); clearTimeout(t); };
  }, [loadList]);

  // Open the page from the URL (#/notes/<id>), or the first page.
  useEffect(() => {
    if (!list) return;
    const id = noteId && list.some((n) => n.id === noteId) ? noteId : null;
    if (!id) {
      const first = list.find((n) => !n.parentId);
      if (first) window.location.replace(`#/notes/${first.id}`);
      else setNote(null);
      return;
    }
    if (note?.id === id) return;
    let cancelled = false;
    api(`/notes/${id}`).then((n) => { if (!cancelled) setNote(n); }, (err) => setError(err.message));
    // Expand the ancestors so the open page is visible in the tree.
    setExpanded((prev) => {
      const next = new Set(prev);
      let cur = list.find((n) => n.id === id);
      while (cur?.parentId) { next.add(cur.parentId); cur = list.find((n) => n.id === cur.parentId); }
      return next;
    });
    return () => { cancelled = true; };
  }, [list, noteId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create(parentId) {
    try {
      const n = await api('/notes', { method: 'POST', body: parentId ? { parentId } : {} });
      setList((l) => [...(l ?? []), n]);
      if (parentId) setExpanded((s) => new Set(s).add(parentId));
      window.location.hash = `#/notes/${n.id}`;
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(n) {
    const kids = list.filter((x) => x.parentId === n.id).length;
    const msg = `Delete "${n.title || 'Untitled'}"${kids ? ' and its sub-pages' : ''}? This can't be undone.`;
    if (!window.confirm(msg)) return;
    try {
      await api(`/notes/${n.id}`, { method: 'DELETE' });
      if (note?.id === n.id) { setNote(null); window.location.hash = '#/notes'; }
      await loadList();
    } catch (err) {
      setError(err.message);
    }
  }

  async function setIcon(n, icon) {
    setList((l) => l.map((x) => (x.id === n.id ? { ...x, icon } : x)));
    if (note?.id === n.id) setNote((cur) => ({ ...cur, icon }));
    try {
      await api(`/notes/${n.id}`, { method: 'PUT', body: { icon } });
    } catch (err) {
      setError(err.message);
    }
  }

  const tree = useMemo(() => buildTree(list ?? []), [list]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? (list ?? []).filter((n) => (n.title || 'untitled').toLowerCase().includes(q)) : null;
  }, [list, query]);

  const toggle = (id) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  function renderBranch(parentId, depth) {
    return (tree.get(parentId) ?? []).map((n) => {
      const kids = tree.get(n.id)?.length ?? 0;
      const open = expanded.has(n.id);
      return (
        <li key={n.id}>
          <PageRow
            n={n} depth={depth} hasKids={kids > 0} open={open} active={note?.id === n.id}
            onToggle={() => toggle(n.id)} onAdd={() => create(n.id)} onDelete={() => remove(n)}
          />
          {open && kids > 0 && <ul>{renderBranch(n.id, depth + 1)}</ul>}
        </li>
      );
    });
  }

  return (
    <div className="notes">
      <aside className="notes-side card" aria-label="Pages">
        <div className="notes-side-head">
          <strong>Notes</strong>
          <button type="button" className="tool" title="New page" aria-label="New page" onClick={() => create(null)}>＋</button>
        </div>
        <input
          type="search" className="notes-search" placeholder="Search pages" aria-label="Search pages"
          value={query} onChange={(e) => setQuery(e.target.value)}
        />
        {list === null ? (
          <p className="muted small">Loading…</p>
        ) : list.length === 0 ? (
          <p className="muted small">No pages yet.</p>
        ) : matches ? (
          <ul className="page-tree">
            {matches.map((n) => <li key={n.id}><PageRow n={n} depth={0} active={note?.id === n.id} onDelete={() => remove(n)} /></li>)}
            {matches.length === 0 && <li className="muted small">No match.</li>}
          </ul>
        ) : (
          <ul className="page-tree">{renderBranch('root', 0)}</ul>
        )}
        <button type="button" className="secondary wide new-page" onClick={() => create(null)}>＋ New page</button>
      </aside>

      <section className="notes-main card">
        {error && <p className="banner error" role="alert">{error} <button className="link" onClick={() => setError(null)}>Dismiss</button></p>}
        {note ? (
          <>
            <IconPicker value={note.icon} onPick={(icon) => setIcon(note, icon)} />
            <NoteEditor
              key={note.id}
              note={note}
              onTitleChange={(title) => setList((l) => l.map((x) => (x.id === note.id ? { ...x, title } : x)))}
            />
          </>
        ) : list && list.length === 0 ? (
          <div className="notes-empty">
            <h1>Your notes</h1>
            <p className="muted">Write course notes with colors, headings, formulas and photos. Type <kbd>/</kbd> in a page for quick commands.</p>
            <button type="button" onClick={() => create(null)}>Create your first page</button>
          </div>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </section>
    </div>
  );
}

function PageRow({ n, depth, hasKids, open, active, onToggle, onAdd, onDelete }) {
  return (
    <div className={`page-row ${active ? 'active' : ''}`} style={{ paddingLeft: 4 + depth * 14 }}>
      {onToggle ? (
        <button type="button" className={`twisty ${hasKids ? '' : 'empty'}`} aria-label={open ? 'Collapse' : 'Expand'} aria-expanded={open} onClick={onToggle}>
          {hasKids ? (open ? '▾' : '▸') : '•'}
        </button>
      ) : <span className="twisty empty">•</span>}
      <a href={`#/notes/${n.id}`} className="page-link" aria-current={active ? 'page' : undefined}>
        <span className="page-icon">{n.icon || '📄'}</span>
        <span className="page-title">{n.title || 'Untitled'}</span>
      </a>
      <span className="row-actions">
        {onAdd && <button type="button" className="tool" title="Add sub-page" aria-label="Add sub-page" onClick={onAdd}>＋</button>}
        <button type="button" className="tool" title="Delete page" aria-label="Delete page" onClick={onDelete}>🗑</button>
      </span>
    </div>
  );
}

function IconPicker({ value, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="icon-picker">
      <button type="button" className="note-icon" title="Change icon" aria-label="Change icon" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {value || '📄'}
      </button>
      {open && (
        <div className="icon-pop" role="menu">
          {ICONS.map((i) => (
            <button key={i} type="button" role="menuitem" onClick={() => { onPick(i); setOpen(false); }}>{i}</button>
          ))}
          <button type="button" role="menuitem" className="small" onClick={() => { onPick(''); setOpen(false); }}>None</button>
        </div>
      )}
    </div>
  );
}

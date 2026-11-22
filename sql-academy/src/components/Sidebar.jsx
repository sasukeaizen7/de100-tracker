import { useMemo, useState } from 'react';
import { chapters } from '../content';
import { useLearned } from '../progress';

// Searchable table of contents: chapters and their concept pages.
export function Sidebar({ current }) {
  const learned = useLearned();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return chapters;
    return chapters
      .map((ch) => ({
        ...ch,
        concepts: ch.concepts.filter((c) => {
          const text = `${c.title} ${c.summary} ${JSON.stringify(c.body)}`.toLowerCase();
          return words.every((w) => text.includes(w));
        }),
      }))
      .filter((ch) => ch.concepts.length);
  }, [q]);

  return (
    <nav className="sidebar" aria-label="Chapters">
      <input className="search" type="search" placeholder="Search concepts…" value={q} onChange={(e) => setQ(e.target.value)} />
      {filtered.map((ch) => {
        const done = ch.concepts.filter((c) => learned[c.id]).length;
        return (
          <section key={ch.id} className="nav-chapter" style={{ '--hue': ch.hue }}>
            <div className="nav-chapter-title">
              <span className="chip">{ch.icon}</span>
              <span>{ch.title}</span>
              <span className="nav-count">{done}/{ch.concepts.length}</span>
            </div>
            <ul>
              {ch.concepts.map((c) => (
                <li key={c.id}>
                  <a href={`#/c/${c.id}`} className={`${c.id === current ? 'active' : ''} ${learned[c.id] ? 'done' : ''}`}>
                    {c.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {!filtered.length && <p className="muted small">No concept matches "{q}".</p>}
    </nav>
  );
}

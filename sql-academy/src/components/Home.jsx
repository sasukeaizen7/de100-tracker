import { chapters, concepts } from '../content';
import { useLearned } from '../progress';

const LEVELS = { basic: 'Basic', intermediate: 'Intermediate', advanced: 'Advanced' };

export function Home() {
  const learned = useLearned();
  const total = concepts.length;
  const done = concepts.filter((c) => learned[c.id]).length;
  const next = concepts.find((c) => !learned[c.id]);
  const exercises = concepts.reduce((n, c) => n + (c.practice?.length ?? 0), 0);
  const examples = concepts.reduce((n, c) => n + c.body.filter((b) => b.sql).length, 0);

  return (
    <div className="home">
      <section className="hero">
        <p className="eyebrow">PostgreSQL · from first SELECT to data engineering</p>
        <h1>Learn SQL by running it</h1>
        <p className="lead">
          {total} concepts, each with a full explanation, comparison tables, {examples} editable examples and {exercises} exercises
          checked automatically. A real PostgreSQL runs in your browser, so nothing to install.
        </p>
        <div className="hero-stats">
          <div><b>{done}</b><span>of {total} learned</span></div>
          <div className="hero-bar"><span style={{ width: `${(100 * done) / total}%` }} /></div>
          {next && <a className="cta" href={`#/c/${next.id}`}>{done ? 'Continue' : 'Start'}: {next.title} →</a>}
          <a className="cta secondary" href="#/courses">SQL courses for data engineering</a>
        </div>
      </section>

      <div className="chapter-grid">
        {chapters.map((ch, i) => {
          const d = ch.concepts.filter((c) => learned[c.id]).length;
          return (
            <section key={ch.id} className="chapter-card" style={{ '--hue': ch.hue }}>
              <header>
                <span className="chip big">{ch.icon}</span>
                <div>
                  <p className="eyebrow">Chapter {i + 1}</p>
                  <h2>{ch.title}</h2>
                </div>
              </header>
              <p className="muted">{ch.blurb}</p>
              <div className="mini-bar"><span style={{ width: `${(100 * d) / ch.concepts.length}%` }} /></div>
              <ol>
                {ch.concepts.map((c) => (
                  <li key={c.id}>
                    <a href={`#/c/${c.id}`} className={learned[c.id] ? 'done' : ''}>{c.title}</a>
                    <span className={`level ${c.level}`}>{LEVELS[c.level]}</span>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>

      <footer className="home-foot muted small">
        Practice data: a small Paris bike shop (customers, products, orders, order items, employees, website events).
        "Reset data" rebuilds it at any time. Progress is saved in this browser.
      </footer>
    </div>
  );
}

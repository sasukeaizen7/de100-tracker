import { concepts, conceptById } from '../content';
import { setLearned, useLearned } from '../progress';
import { Blocks } from './Blocks';
import { Practice } from './Practice';
import { Rich } from './Rich';

const LEVELS = { basic: 'Basic', intermediate: 'Intermediate', advanced: 'Advanced' };

export function ConceptPage({ concept }) {
  const learned = useLearned();
  const isLearned = !!learned[concept.id];
  const prev = concepts[concept.index - 1];
  const next = concepts[concept.index + 1];
  const position = concept.chapter.concepts.findIndex((c) => c.id === concept.id) + 1;

  return (
    <article className="concept" style={{ '--hue': concept.chapter.hue }}>
      <header className="concept-hero">
        <p className="eyebrow">
          <span className="chip">{concept.chapter.icon}</span> {concept.chapter.title} · {position} of {concept.chapter.concepts.length}
        </p>
        <h1>{concept.title}</h1>
        <Rich as="p" className="lead" text={concept.summary} />
        <div className="hero-meta">
          <span className={`level ${concept.level}`}>{LEVELS[concept.level]}</span>
          <button className={isLearned ? 'learned on' : 'learned'} onClick={() => setLearned(concept.id, !isLearned)}>
            {isLearned ? '✓ Learned' : 'Mark as learned'}
          </button>
        </div>
      </header>

      <div className="concept-body">
        <Blocks blocks={concept.body} />
      </div>

      {concept.practice?.length > 0 && (
        <section className="panel practice-panel">
          <h2>Practice</h2>
          <p className="muted">Write a query, then <b>Check my answer</b>: the app runs your query and the solution and compares the results. Exercises never change the data.</p>
          {concept.practice.map((p, i) => <Practice key={i} item={p} index={i} />)}
        </section>
      )}

      {concept.interview?.length > 0 && (
        <section className="panel interview-panel">
          <h2>Interview questions</h2>
          {concept.interview.map((q, i) => (
            <details key={i}>
              <summary><Rich text={q.q} /></summary>
              <Rich as="p" text={q.a} />
            </details>
          ))}
        </section>
      )}

      {concept.related?.length > 0 && (
        <section className="related">
          <h2>Related</h2>
          <div className="related-list">
            {concept.related.map((id) => {
              const r = conceptById[id];
              return (
                <a key={id} href={`#/c/${id}`} className="related-card" style={{ '--hue': r.chapter.hue }}>
                  <span className="chip">{r.chapter.icon}</span>
                  <span><b>{r.title}</b><small>{r.chapter.title}</small></span>
                </a>
              );
            })}
          </div>
        </section>
      )}

      <nav className="pager">
        {prev ? <a href={`#/c/${prev.id}`} style={{ '--hue': prev.chapter.hue }}><small>← Previous</small>{prev.title}</a> : <span />}
        {next ? <a href={`#/c/${next.id}`} className="next" style={{ '--hue': next.chapter.hue }}><small>Next →</small>{next.title}</a> : <span />}
      </nav>
    </article>
  );
}

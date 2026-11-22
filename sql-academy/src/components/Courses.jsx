import { chapters } from '../content';
import { COURSES_CHECKED, courses, tracks } from '../content/courses';

const chapterById = Object.fromEntries(chapters.map((c) => [c.id, c]));

function Stars({ rating }) {
  if (rating == null) return <span className="muted small">no rating yet</span>;
  return <span className="stars" title={`${rating} out of 5`}><b>{rating.toFixed(1)}</b> ★</span>;
}

export function Courses() {
  return (
    <div className="courses">
      <section className="hero courses-hero">
        <p className="eyebrow">Udemy · SQL for data engineering</p>
        <h1>SQL courses to follow</h1>
        <p className="lead">
          The SQL courses worth your time for a data engineering job, in the order to take them. Each card shows which
          SQL Academy chapters cover the same topics, so you can revise and practise alongside the videos.
        </p>
      </section>

      {tracks.map((track, t) => (
        <section key={track.id} className="track">
          <h2><span className="track-n">{t + 1}</span>{track.title}</h2>
          <p className="muted">{track.blurb}</p>
          <div className="course-grid">
            {courses.filter((c) => c.track === track.id).map((c) => (
              <article key={c.slug} className="course-card">
                <header>
                  <a href={`https://www.udemy.com/course/${c.slug}/`} target="_blank" rel="noreferrer">{c.title}</a>
                  {c.inPlan && <span className="in-plan">in your 100-day plan</span>}
                </header>
                <p className="muted small">{c.instructor}</p>
                <div className="course-meta">
                  <Stars rating={c.rating} />
                  <span>{c.reviews.toLocaleString('en')} reviews</span>
                  <span>{c.hours} h</span>
                  <span>updated {c.updated}</span>
                </div>
                <p>{c.bestFor}</p>
                <div className="course-chapters">
                  {c.chapters.map((id) => {
                    const ch = chapterById[id];
                    return (
                      <a key={id} href={`#/c/${ch.concepts[0].id}`} className="tag" style={{ '--hue': ch.hue }}>
                        {ch.icon} {ch.title}
                      </a>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <p className="muted small home-foot">
        Ratings, reviews and lengths as shown on Udemy on {COURSES_CHECKED}. The SQL Academy pages are written independently:
        they cover the same concepts with their own explanations and exercises, so they complement the videos rather than replace them.
      </p>
    </div>
  );
}

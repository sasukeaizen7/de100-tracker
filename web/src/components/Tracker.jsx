import { useEffect, useMemo, useState } from 'react';
import { DAYS, MONTHS, TOTAL_DAYS, currentDay, dateForDay } from '../data/plan.js';

const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export default function Tracker({ data }) {
  const { profile, days, courses, progress, saveDay } = data;
  const today = currentDay(profile.startDate);
  const [selected, setSelected] = useState(() => Math.min(Math.max(today, 1), TOTAL_DAYS));

  const doneCount = Object.values(days).filter((d) => d.done).length;
  const expected = Math.min(Math.max(today - 1, 0), TOTAL_DAYS);
  const behind = Math.max(expected - DAYS.slice(0, expected).filter((d) => days[d.day]?.done).length, 0);
  const avgCourse = courses.length
    ? Math.round(courses.reduce((sum, c) => sum + (progress[c.id]?.percent ?? 0), 0) / courses.length)
    : 0;
  const postDays = DAYS.filter((d) => d.post);
  const postsDone = postDays.filter((d) => days[d.day]?.done).length;

  return (
    <>
      <section className="stats" aria-label="Summary">
        <Stat label="Today" value={today < 1 ? 'Not started' : today > TOTAL_DAYS ? 'Finished' : `Day ${today}`} />
        <Stat label="Days done" value={`${doneCount} / ${TOTAL_DAYS}`} />
        <Stat label="Behind plan" value={behind === 0 ? 'On track' : `${behind} day${behind > 1 ? 's' : ''}`} tone={behind ? 'warn' : 'ok'} />
        <Stat label="Courses (avg.)" value={`${avgCourse}%`} />
        <Stat label="Posts published" value={`${postsDone} / ${postDays.length}`} />
      </section>

      <div className="tracker">
        <div className="months">
          {MONTHS.map((m) => (
            <section key={m.name} className="card">
              <h2>{m.name}</h2>
              <div className="grid">
                {DAYS.filter((d) => d.day >= m.from && d.day <= m.to).map((d) => (
                  <button
                    key={d.day}
                    className={['cell', d.type, days[d.day]?.done && 'done', d.day === today && 'today', d.day === selected && 'selected']
                      .filter(Boolean).join(' ')}
                    onClick={() => setSelected(d.day)}
                    title={`Day ${d.day}: ${d.focus}`}
                    aria-label={`Day ${d.day}, ${d.focus}${days[d.day]?.done ? ', done' : ''}`}
                  >
                    {d.day}
                  </button>
                ))}
              </div>
            </section>
          ))}
          <p className="legend muted small">
            <span className="swatch study" /> Study <span className="swatch project" /> Project
            <span className="swatch share" /> Build &amp; Share <span className="swatch prep" /> Interview prep <span className="swatch milestone" /> Milestone
            <span className="swatch done" /> Done
          </p>
        </div>

        <DayPanel
          key={selected}
          plan={DAYS[selected - 1]}
          log={days[selected]}
          date={dateForDay(profile.startDate, selected)}
          course={courses.find((c) => c.slug === DAYS[selected - 1].course)}
          progress={progress}
          onSave={(patch) => saveDay(selected, patch)}
        />
      </div>
    </>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="muted small">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function DayPanel({ plan, log, date, course, progress, onSave }) {
  const [notes, setNotes] = useState(log?.notes ?? '');
  useEffect(() => setNotes(log?.notes ?? ''), [log?.notes]);
  const done = Boolean(log?.done);

  const typeLabel = useMemo(
    () => ({ study: 'Study day', project: 'Project day', share: 'Build & Share day', prep: 'Interview prep', milestone: 'Milestone' })[plan.type],
    [plan.type],
  );

  return (
    <aside className="card panel" aria-label={`Day ${plan.day} details`}>
      <div className="muted small">{fmt.format(date)} · Week {plan.week} · {typeLabel}</div>
      <h2>Day {plan.day}: {plan.focus}</h2>

      {course && (
        <p className="course-line">
          <a href={course.udemyUrl} target="_blank" rel="noreferrer noopener">{course.title}</a>
          <span className="pill">{progress[course.id]?.percent ?? 0}%</span>
        </p>
      )}
      {plan.repo && <p className="small"><strong>Repo:</strong> {plan.repo}</p>}
      {plan.post && <p className="small"><strong>LinkedIn:</strong> {plan.post}</p>}

      <ul className="tasks">
        {plan.tasks.map((t) => <li key={t}>{t}</li>)}
      </ul>

      <label className="check">
        <input type="checkbox" checked={done} onChange={(e) => onSave({ done: e.target.checked })} />
        Mark day {plan.day} as done
      </label>

      <label className="stack">
        Notes
        <textarea
          rows={5}
          maxLength={2000}
          value={notes}
          placeholder="What you learned, what broke, what to revisit…"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (log?.notes ?? '') && onSave({ notes })}
        />
      </label>
      <div className="muted small">{notes.length} / 2000 · saves when you leave the field</div>
    </aside>
  );
}

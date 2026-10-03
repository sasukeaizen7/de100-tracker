import { useEffect, useState } from 'react';

const rel = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function timeAgo(iso) {
  if (!iso) return 'never';
  const mins = Math.round((new Date(iso) - Date.now()) / 60_000);
  if (Math.abs(mins) < 60) return rel.format(mins, 'minute');
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 48) return rel.format(hours, 'hour');
  return rel.format(Math.round(hours / 24), 'day');
}

export default function Courses({ data }) {
  const { courses, progress, saveProgress } = data;
  return (
    <section className="card">
      <h1>Courses</h1>
      <p className="muted">Set progress by hand, or sync it from Udemy with the Chrome extension. A sync overwrites the manual value.</p>
      <ul className="courses">
        {courses.map((c) => (
          <CourseRow key={c.id} course={c} row={progress[c.id]} onSave={(p) => saveProgress(c.id, p)} />
        ))}
      </ul>
    </section>
  );
}

function CourseRow({ course, row, onSave }) {
  const saved = row?.percent ?? 0;
  const [value, setValue] = useState(saved);
  useEffect(() => setValue(saved), [saved]);
  const commit = () => value !== saved && onSave(value);

  return (
    <li className="course">
      <div className="course-head">
        <div>
          <a href={course.udemyUrl} target="_blank" rel="noreferrer noopener"><strong>{course.title}</strong></a>
          <div className="muted small">
            {course.instructor ? `${course.instructor} · ` : ''}Days {course.startDay}
            {course.endDay !== course.startDay ? `–${course.endDay}` : ''}
          </div>
        </div>
        <div className="right small">
          <span className={`pill ${row?.source === 'extension' ? 'ext' : ''}`}>{row?.source === 'extension' ? 'Synced' : 'Manual'}</span>
          <div className="muted">updated {timeAgo(row?.syncedAt)}</div>
        </div>
      </div>
      <div className="course-bar">
        <input
          type="range" min="0" max="100" step="1"
          value={value}
          aria-label={`${course.title} progress`}
          onChange={(e) => setValue(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
        />
        <output>{value}%</output>
      </div>
    </li>
  );
}

// Small explanatory SVG diagrams, referenced from content as { diagram: 'name' }.

function Venn({ fillLeft, fillMid, fillRight, label }) {
  const id = `clip-${label.replace(/\W+/g, '')}`;
  return (
    <figure className="diagram venn">
      <svg viewBox="0 0 200 120" role="img" aria-label={label}>
        <defs>
          <clipPath id={id}><circle cx="78" cy="60" r="44" /></clipPath>
        </defs>
        <circle cx="78" cy="60" r="44" className={fillLeft ? 'v-on' : 'v-off'} />
        <circle cx="122" cy="60" r="44" className={fillRight ? 'v-on' : 'v-off'} />
        <circle cx="122" cy="60" r="44" clipPath={`url(#${id})`} className={fillMid ? 'v-on v-mid' : 'v-cut'} />
        <circle cx="78" cy="60" r="44" className="v-line" />
        <circle cx="122" cy="60" r="44" className="v-line" />
        <text x="52" y="64" className="v-text">A</text>
        <text x="140" y="64" className="v-text">B</text>
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function Joins() {
  return (
    <div className="diagram-row">
      <Venn label="INNER JOIN" fillMid />
      <Venn label="LEFT JOIN" fillLeft fillMid />
      <Venn label="RIGHT JOIN" fillRight fillMid />
      <Venn label="FULL JOIN" fillLeft fillMid fillRight />
      <Venn label="ANTI JOIN (A not in B)" fillLeft />
    </div>
  );
}

function QueryOrder() {
  const steps = [
    ['FROM / JOIN', 'pick and combine tables'],
    ['WHERE', 'filter rows'],
    ['GROUP BY', 'form groups'],
    ['HAVING', 'filter groups'],
    ['SELECT', 'compute columns'],
    ['WINDOW', 'window functions'],
    ['DISTINCT', 'remove duplicates'],
    ['ORDER BY', 'sort'],
    ['LIMIT', 'cut'],
  ];
  return (
    <figure className="diagram">
      <ol className="flow">
        {steps.map(([k, v], i) => (
          <li key={k} style={{ '--i': i }}><span className="flow-n">{i + 1}</span><b>{k}</b><small>{v}</small></li>
        ))}
      </ol>
      <figcaption>Logical order of evaluation — not the order you write the clauses.</figcaption>
    </figure>
  );
}

function Frame() {
  // 8 rows; current row = 5; frame ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
  const rows = [1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <figure className="diagram">
      <svg viewBox="0 0 420 110" role="img" aria-label="Window frame: 2 preceding rows and the current row">
        {rows.map((r, i) => {
          const inFrame = r >= 3 && r <= 5;
          const current = r === 5;
          return (
            <g key={r} transform={`translate(${12 + i * 50}, 30)`}>
              <rect width="42" height="42" rx="8" className={current ? 'f-current' : inFrame ? 'f-in' : 'f-out'} />
              <text x="21" y="27" className="f-text">{r}</text>
            </g>
          );
        })}
        <path d="M 112 22 h 142" className="f-brace" />
        <text x="183" y="15" className="f-label">frame: 2 PRECEDING → CURRENT ROW</text>
        <text x="233" y="95" className="f-label">current row</text>
        <path d="M 233 80 v -6" className="f-brace" />
      </svg>
      <figcaption>The partition is all 8 rows; the function sees only the frame (rows 3–5) when computing row 5.</figcaption>
    </figure>
  );
}

function Islands() {
  const days = [
    ['04-01', 1, 'A'], ['04-02', 2, 'A'], ['04-03', 3, 'A'], ['04-05', 4, 'B'], ['04-06', 5, 'B'],
  ];
  return (
    <figure className="diagram">
      <table className="grid compact">
        <thead><tr><th>day</th><th>row_number</th><th>day − row_number</th><th>island</th></tr></thead>
        <tbody>
          {days.map(([d, n, g]) => (
            <tr key={d} className={g === 'A' ? 'isl-a' : 'isl-b'}>
              <td>{d}</td><td>{n}</td><td>{g === 'A' ? '03-31' : '04-01'}</td><td>{g}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption>Consecutive days and row numbers both go up by 1, so their difference stays constant inside a streak.</figcaption>
    </figure>
  );
}

function Star() {
  return (
    <figure className="diagram">
      <svg viewBox="0 0 360 200" role="img" aria-label="Star schema: one fact table in the middle, four dimensions around it">
        {[
          [180, 30, 'dim_date'], [40, 100, 'dim_customer'], [320, 100, 'dim_product'], [180, 172, 'dim_store'],
        ].map(([x, y, t]) => (
          <g key={t}>
            <line x1="180" y1="100" x2={x} y2={y} className="s-line" />
            <rect x={x - 52} y={y - 16} width="104" height="32" rx="8" className="s-dim" />
            <text x={x} y={y + 5} className="s-text">{t}</text>
          </g>
        ))}
        <rect x="118" y="80" width="124" height="40" rx="10" className="s-fact" />
        <text x="180" y="105" className="s-text s-fact-text">fact_sales</text>
      </svg>
      <figcaption>Facts hold the measures (quantity, revenue) and foreign keys; dimensions describe them.</figcaption>
    </figure>
  );
}

const DIAGRAMS = { joins: Joins, 'query-order': QueryOrder, frame: Frame, islands: Islands, star: Star };

export function Diagram({ name }) {
  const D = DIAGRAMS[name];
  return D ? <D /> : null;
}

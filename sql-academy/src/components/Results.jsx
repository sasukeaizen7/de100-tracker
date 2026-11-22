const MAX_ROWS = 200;

function cell(v) {
  if (v === null || v === undefined) return <span className="null">NULL</span>;
  if (v instanceof Date) return v.toISOString().replace('T', ' ').replace(/\.000Z$/, 'Z');
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

export function Results({ result }) {
  if (!result) return null;
  return (
    <div className="result">
      {result.notices.map((n, i) => <div key={i} className="notice">NOTICE: {n}</div>)}
      {result.ok && result.sets.length === 0 && (
        <div className="muted">Done{result.affected ? ` — ${result.affected} row(s) affected` : ''}.</div>
      )}
      {result.sets.map((set, i) => (
        <div className="table-scroll" key={i}>
          <table className="grid">
            <thead><tr>{set.columns.map((c, j) => <th key={j}>{c}</th>)}</tr></thead>
            <tbody>
              {set.rows.slice(0, MAX_ROWS).map((row, r) => (
                <tr key={r}>{row.map((v, j) => <td key={j}>{cell(v)}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <div className="muted small">
            {set.rows.length} row{set.rows.length === 1 ? '' : 's'}
            {set.rows.length > MAX_ROWS ? ` (first ${MAX_ROWS} shown)` : ''}
          </div>
        </div>
      ))}
      {!result.ok && (
        <div className="error-box">
          <strong>Error{result.statement ? ` in statement ${result.statement}` : ''}</strong> {result.error}
          {result.detail && <div>Detail: {result.detail}</div>}
          {result.hint && <div>Hint: {result.hint}</div>}
        </div>
      )}
      <div className="muted small">
        {result.ms} ms{result.wrote ? ' · this changed the practice data — "Reset data" restores it' : ''}
      </div>
    </div>
  );
}

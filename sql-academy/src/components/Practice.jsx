import { useState } from 'react';
import { compare, run } from '../db';
import { Code } from './Code';
import { Results } from './Results';
import { Rich } from './Rich';

// An exercise: write a query, the app runs it and the solution and compares the results.
export function Practice({ item, index }) {
  const [sql, setSql] = useState(item.starter ?? '');
  const [verdict, setVerdict] = useState(null);
  const [result, setResult] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setBusy(true);
    setResult(await run(`begin;\n${sql}\n;rollback;`));
    setVerdict(await compare(sql, item.solution, { ordered: item.ordered }));
    setBusy(false);
  };

  return (
    <div className="practice">
      <div className="practice-q"><span className="badge">Exercise {index + 1}</span> <Rich text={item.q} /></div>
      <textarea
        className="practice-input"
        value={sql}
        spellCheck={false}
        placeholder="Write your query here…  (Ctrl+Enter to check)"
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); check(); } }}
        rows={5}
      />
      <div className="practice-actions">
        <button className="run" onClick={check} disabled={busy || !sql.trim()}>{busy ? 'Checking…' : 'Check my answer'}</button>
        {item.hint && <button className="ghost" onClick={() => setShowHint(!showHint)}>{showHint ? 'Hide hint' : 'Hint'}</button>}
        <button className="ghost" onClick={() => setShowSolution(!showSolution)}>{showSolution ? 'Hide solution' : 'Solution'}</button>
      </div>
      {verdict && (
        verdict.ok
          ? <div className={verdict.same ? 'verdict good' : 'verdict bad'}>
              {verdict.same
                ? '✓ Correct — your result matches the expected one.'
                : `✗ Not yet — you returned ${verdict.got} row(s), the expected result has ${verdict.want}${verdict.got === verdict.want ? ' but the values differ' : ''}.`}
              {item.ordered && !verdict.same ? ' Row order matters here.' : ''}
            </div>
          : <div className="verdict bad">✗ Your query failed: {verdict.error}</div>
      )}
      {result && result.ok && <Results result={{ ...result, wrote: false }} />}
      {showHint && <div className="hint"><Rich text={item.hint} /></div>}
      {showSolution && (
        <div className="solution">
          <Code sql={item.solution.trim()} />
          {item.why && <Rich as="p" text={item.why} />}
        </div>
      )}
    </div>
  );
}

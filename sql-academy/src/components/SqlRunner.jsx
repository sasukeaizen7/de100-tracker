import { useRef, useState } from 'react';
import { run } from '../db';
import { highlight } from './Code';
import { Results } from './Results';
import { Rich } from './Rich';

// An editable, runnable SQL example. The highlighted layer sits under a transparent textarea.
export function SqlRunner({ sql, title, note, runnable = true }) {
  const [code, setCode] = useState(sql.trim());
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const pre = useRef(null);

  const execute = async () => {
    setBusy(true);
    setResult(await run(code));
    setBusy(false);
  };
  const onKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); execute(); }
    if (e.key === 'Tab') {
      e.preventDefault();
      const t = e.target, s = t.selectionStart;
      setCode(code.slice(0, s) + '  ' + code.slice(t.selectionEnd));
      requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; });
    }
  };
  const copy = () => navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); });

  return (
    <figure className="runner">
      <div className="runner-head">
        <span className="runner-title">{title || 'Example'}</span>
        <span className="runner-actions">
          {code !== sql.trim() && <button className="ghost" onClick={() => { setCode(sql.trim()); setResult(null); }}>Undo edits</button>}
          <button className="ghost" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          {runnable && <button className="run" onClick={execute} disabled={busy}>{busy ? 'Running…' : '▶ Run'}</button>}
        </span>
      </div>
      <div className="editor">
        <pre ref={pre} aria-hidden="true" className="code"><code dangerouslySetInnerHTML={{ __html: highlight(code) + '\n' }} /></pre>
        <textarea
          value={code}
          spellCheck={false}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={onKey}
          onScroll={(e) => { if (pre.current) { pre.current.scrollTop = e.target.scrollTop; pre.current.scrollLeft = e.target.scrollLeft; } }}
          rows={Math.min(Math.max(code.split('\n').length, 2), 28)}
          aria-label={title || 'SQL'}
        />
      </div>
      {note && <figcaption><Rich text={note} /></figcaption>}
      {!runnable && <figcaption className="muted">Shown for reference: this one isn't runnable in the browser.</figcaption>}
      <Results result={result} />
    </figure>
  );
}

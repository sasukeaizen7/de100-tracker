import { useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';

const TEMPLATES = [
  ['Fraction', '\\frac{a}{b}'],
  ['Power', 'x^{2}'],
  ['Index', 'x_{i}'],
  ['Root', '\\sqrt{x}'],
  ['Sum', '\\sum_{i=1}^{n} x_i'],
  ['Integral', '\\int_{a}^{b} f(x)\\,dx'],
  ['Limit', '\\lim_{x \\to \\infty} f(x)'],
  ['Matrix', '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'],
  ['Greek', '\\alpha \\beta \\gamma \\theta \\lambda \\sigma'],
  ['Arrows', '\\rightarrow \\Rightarrow \\leftrightarrow'],
];

// Write or edit a formula with a live preview. `display` = block formula (centered, larger).
export default function MathDialog({ initial = '', display = false, editing = false, onSave, onDelete, onClose }) {
  const [latex, setLatex] = useState(initial);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const preview = useMemo(() => {
    try {
      return { html: katex.renderToString(latex || '\\;', { displayMode: display, throwOnError: true }) };
    } catch (err) {
      return { error: err.message.replace(/^KaTeX parse error: /, '') };
    }
  }, [latex, display]);

  function insertTemplate(t) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? latex.length;
    const end = el?.selectionEnd ?? latex.length;
    setLatex(latex.slice(0, start) + t + latex.slice(end));
    requestAnimationFrame(() => el?.focus());
  }

  const submit = (e) => {
    e.preventDefault();
    if (latex.trim() && !preview.error) onSave(latex.trim());
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal card" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Formula">
        <h2>{editing ? 'Edit formula' : display ? 'Insert block formula' : 'Insert inline formula'}</h2>
        <div className="math-templates">
          {TEMPLATES.map(([label, t]) => (
            <button key={label} type="button" className="chip" onClick={() => insertTemplate(t)}>{label}</button>
          ))}
        </div>
        <label className="stack">
          LaTeX
          <textarea
            ref={inputRef}
            rows={3}
            maxLength={display ? 5000 : 2000}
            spellCheck={false}
            className="mono"
            value={latex}
            placeholder="e.g. E = mc^2"
            onChange={(e) => setLatex(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e); }}
          />
        </label>
        <div className={`math-preview ${display ? 'display' : ''}`} aria-live="polite">
          {preview.error
            ? <span className="math-error">{preview.error}</span>
            : <span dangerouslySetInnerHTML={{ __html: preview.html }} />}
        </div>
        <div className="modal-actions">
          {editing && <button type="button" className="danger" onClick={onDelete}>Delete</button>}
          <span className="spacer" />
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={!latex.trim() || Boolean(preview.error)}>{editing ? 'Update' : 'Insert'}</button>
        </div>
        <p className="muted small">Ctrl+Enter to save · Esc to close</p>
      </form>
    </div>
  );
}

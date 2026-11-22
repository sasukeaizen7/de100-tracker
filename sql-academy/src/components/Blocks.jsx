import { Diagram } from './Diagrams';
import { Rich } from './Rich';
import { SqlRunner } from './SqlRunner';

const CALLOUT_TITLES = { trap: 'Common mistake', tip: 'Tip', de: 'In data engineering', note: 'Note', analogy: 'Think of it like this' };

// Renders a concept's body: an array of blocks such as { p }, { h }, { sql }, { table }, { callout }.
export function Blocks({ blocks }) {
  return blocks.map((b, i) => <Block key={i} b={b} />);
}

function Block({ b }) {
  if (b.p) return <Rich as="p" text={b.p} />;
  if (b.h) return <h3>{b.h}</h3>;
  if (b.list) {
    const Tag = b.ordered ? 'ol' : 'ul';
    return <Tag className="list">{b.list.map((li, i) => <Rich as="li" key={i} text={li} />)}</Tag>;
  }
  if (b.sql) return <SqlRunner sql={b.sql} title={b.title} note={b.note} runnable={b.run !== false} />;
  if (b.diagram) return <Diagram name={b.diagram} />;
  if (b.callout) {
    return (
      <aside className={`callout ${b.callout}`}>
        <strong>{b.title || CALLOUT_TITLES[b.callout]}</strong>
        <Rich as="div" text={b.text} />
      </aside>
    );
  }
  if (b.table) {
    const { head, rows, caption } = b.table;
    return (
      <div className="table-scroll">
        <table className="grid compare">
          {caption && <caption>{caption}</caption>}
          <thead><tr>{head.map((h, i) => <th key={i}><Rich text={h} /></th>)}</tr></thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>{row.map((c, j) => <td key={j} className={mark(c)}><Rich text={String(c).replace(/^[+\-~] /, '')} /></td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (b.steps) {
    return (
      <ol className="steps">
        {b.steps.map((s, i) => <li key={i}><Rich text={s} /></li>)}
      </ol>
    );
  }
  return null;
}

// Cells starting with "+ ", "- " or "~ " are coloured good / bad / partial.
function mark(c) {
  const s = String(c);
  if (s.startsWith('+ ')) return 'yes';
  if (s.startsWith('- ')) return 'no';
  if (s.startsWith('~ ')) return 'part';
  return undefined;
}

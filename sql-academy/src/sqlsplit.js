// Splits a SQL script into statements on top-level semicolons, like psql does.
// Understands 'strings', "identifiers", E'escapes', $tag$ bodies $tag$, -- and /* */ comments.
// Statements that are only comments are dropped.
export function splitSql(sql) {
  const out = [];
  let start = 0;
  let i = 0;
  const n = sql.length;
  const push = (end) => {
    const stmt = sql.slice(start, end).trim();
    if (stmt && stripComments(stmt).trim()) out.push(stmt);
    start = end + 1;
  };

  while (i < n) {
    const c = sql[i];
    const next = sql[i + 1];
    if (c === '-' && next === '-') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? n : nl + 1;
    } else if (c === '/' && next === '*') {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') { depth++; i += 2; }
        else if (sql[i] === '*' && sql[i + 1] === '/') { depth--; i += 2; }
        else i++;
      }
    } else if (c === "'") {
      const escapes = /[eE]/.test(sql[i - 1] ?? '') && !/\w/.test(sql[i - 2] ?? '');
      i++;
      while (i < n) {
        if (escapes && sql[i] === '\\') { i += 2; continue; }
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") { i += 2; continue; }
          break;
        }
        i++;
      }
      i++;
    } else if (c === '"') {
      i++;
      while (i < n && !(sql[i] === '"' && sql[i + 1] !== '"')) i += sql[i] === '"' ? 2 : 1;
      i++;
    } else if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (m && !/\w/.test(sql[i - 1] ?? '')) {
        const tag = m[0];
        const end = sql.indexOf(tag, i + tag.length);
        i = end === -1 ? n : end + tag.length;
      } else i++;
    } else if (c === ';') {
      push(i);
      i++;
    } else i++;
  }
  push(n);
  return out;
}

export function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

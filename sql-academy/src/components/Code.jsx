import { useMemo } from 'react';
import hljs from 'highlight.js/lib/core';
import pgsql from 'highlight.js/lib/languages/pgsql';

hljs.registerLanguage('pgsql', pgsql);

export function highlight(sql) {
  return hljs.highlight(sql, { language: 'pgsql' }).value;
}

export function Code({ sql }) {
  const html = useMemo(() => highlight(sql), [sql]);
  return <pre className="code"><code dangerouslySetInnerHTML={{ __html: html }} /></pre>;
}

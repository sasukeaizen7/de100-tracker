// Tiny inline markup for content text: `code`, **bold**, *italic*, [label](#/c/concept-id).
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function inline(text) {
  const parts = String(text).split(/(`[^`]+`)/g);
  return parts
    .map((part) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length > 1) return `<code>${esc(part.slice(1, -1))}</code>`;
      return esc(part)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
        .replace(/\[([^\]]+)\]\((#\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
    })
    .join('');
}

export function Rich({ text, as: Tag = 'span', className }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: inline(text) }} />;
}

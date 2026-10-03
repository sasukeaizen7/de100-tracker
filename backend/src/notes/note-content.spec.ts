import { sanitizeNoteContent } from './note-content';

const doc = (...content: unknown[]) => ({ type: 'doc', content });
const p = (...content: unknown[]) => ({ type: 'paragraph', content });
const IMG = '/api/images/123e4567-e89b-12d3-a456-426614174000?sig=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

describe('sanitizeNoteContent', () => {
  it('keeps supported content: colors, sizes, highlight, math and images', () => {
    const input = doc(
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
      p({ type: 'text', text: 'red big', marks: [{ type: 'textStyle', attrs: { color: '#e03e3e', fontSize: '24px' } }, { type: 'bold' }] }),
      p({ type: 'text', text: 'marked', marks: [{ type: 'highlight', attrs: { color: 'rgb(253, 236, 200)' } }] }),
      p({ type: 'inlineMath', attrs: { latex: 'E = mc^2' } }),
      { type: 'blockMath', attrs: { latex: '\\int_0^1 x^2 \\, dx' } },
      { type: 'image', attrs: { src: IMG, alt: 'diagram', width: 400 } },
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p({ type: 'text', text: 'done' })] }] },
    );
    expect(sanitizeNoteContent(input)).toEqual(input);
  });

  it('drops dangerous attribute values instead of storing them', () => {
    const out = sanitizeNoteContent(doc(p({
      type: 'text', text: 'x',
      marks: [
        { type: 'textStyle', attrs: { color: 'red; background:url(https://evil.example/t.gif)', fontSize: '9999px' } },
        { type: 'link', attrs: { href: 'javascript:alert(1)' } },
      ],
    })));
    expect(out).toEqual(doc(p({ type: 'text', text: 'x', marks: [{ type: 'textStyle', attrs: { color: null, fontSize: null } }] })));
  });

  it('forces safe link attributes and strips unknown attributes', () => {
    const out = sanitizeNoteContent(doc(p({
      type: 'text', text: 'site',
      marks: [{ type: 'link', attrs: { href: 'https://example.com', rel: 'opener', onclick: 'x()', class: 'evil' } }],
    })));
    expect(out).toEqual(doc(p({ type: 'text', text: 'site', marks: [{ type: 'link', attrs: { href: 'https://example.com', rel: 'noopener noreferrer nofollow', class: null } }] })));
  });

  it('rejects unknown node and mark types', () => {
    expect(() => sanitizeNoteContent(doc({ type: 'iframe', attrs: { src: 'https://evil.example' } }))).toThrow(/Unsupported block type/);
    expect(() => sanitizeNoteContent(doc(p({ type: 'text', text: 'x', marks: [{ type: 'script' }] })))).toThrow(/Unsupported text style/);
    expect(() => sanitizeNoteContent({ type: 'paragraph' })).toThrow(/must be a doc/);
  });

  it('only allows images uploaded through the API', () => {
    expect(() => sanitizeNoteContent(doc({ type: 'image', attrs: { src: 'https://tracker.example/pixel.gif' } }))).toThrow(/uploaded/);
    expect(() => sanitizeNoteContent(doc({ type: 'image', attrs: { src: 'data:image/svg+xml;base64,PHN2Zz4=' } }))).toThrow(/uploaded/);
  });

  it('limits size and nesting', () => {
    let deep: Record<string, unknown> = p({ type: 'text', text: 'x' });
    for (let i = 0; i < 70; i++) deep = { type: 'blockquote', content: [deep] };
    expect(() => sanitizeNoteContent(doc(deep))).toThrow(/nested too deeply/);
    expect(() => sanitizeNoteContent(doc(p({ type: 'inlineMath', attrs: { latex: 'x'.repeat(2001) } })))).toThrow(/Formula/);
  });
});

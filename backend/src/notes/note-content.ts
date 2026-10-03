import { BadRequestException } from '@nestjs/common';
import type { NoteDoc } from '../db/schema';

// Server-side allowlist for TipTap documents. Unknown node or mark types are
// rejected, unknown attributes are dropped, and attribute values that could
// smuggle in styles, scripts or external tracking (colors, sizes, links,
// image sources) must match strict patterns.

type Json = Record<string, unknown>;
type AttrRule = (value: unknown) => unknown; // returns the cleaned value, or undefined to drop

const MAX_NODES = 50_000;
const MAX_DEPTH = 60;

const COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/;
const FONT_SIZE = /^(\d{1,2}(\.\d)?)(px|rem|em)$/;
const IMAGE_SRC = /^\/api\/images\/[0-9a-f-]{36}\?sig=[A-Za-z0-9_-]{43}$/;
const LANGUAGE = /^[a-z0-9+#-]{1,30}$/i;

const str = (max: number): AttrRule => (v) => (typeof v === 'string' && v.length <= max ? v : undefined);
const nullable = (rule: AttrRule): AttrRule => (v) => (v === null ? null : rule(v));
const pattern = (re: RegExp): AttrRule => (v) => (typeof v === 'string' && re.test(v) ? v : null);
const int = (min: number, max: number): AttrRule => (v) => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? v : undefined);
const dimension: AttrRule = (v) => (v === null || (typeof v === 'number' && v > 0 && v <= 4000) ? v : (typeof v === 'string' && /^\d{1,4}$/.test(v) ? Number(v) : null));
const fontSize: AttrRule = (v) => {
  if (v === null || typeof v !== 'string') return null;
  const m = FONT_SIZE.exec(v);
  if (!m) return null;
  const n = Number(m[1]);
  return (m[3] === 'px' ? n >= 8 && n <= 96 : n >= 0.5 && n <= 6) ? v : null;
};
const href: AttrRule = (v) => (typeof v === 'string' && v.length <= 2000 && /^(https?:\/\/|mailto:)/i.test(v) ? v : null);

const NODES: Record<string, { attrs?: Record<string, AttrRule>; inline?: boolean }> = {
  doc: {},
  paragraph: {},
  text: { inline: true },
  heading: { attrs: { level: int(1, 3) } },
  blockquote: {},
  bulletList: {},
  orderedList: { attrs: { start: int(1, 100_000), type: nullable(pattern(/^[aAiI1]$/)) } },
  listItem: {},
  taskList: {},
  taskItem: { attrs: { checked: (v) => (typeof v === 'boolean' ? v : false) } },
  codeBlock: { attrs: { language: nullable(pattern(LANGUAGE)) } },
  horizontalRule: {},
  hardBreak: { inline: true },
  image: {
    attrs: {
      src: (v) => {
        if (typeof v !== 'string' || !IMAGE_SRC.test(v)) throw new BadRequestException('Images must be uploaded to your notes');
        return v;
      },
      alt: nullable(str(500)),
      title: nullable(str(500)),
      width: dimension,
      height: dimension,
    },
  },
  inlineMath: { inline: true, attrs: { latex: str(2000) } },
  blockMath: { attrs: { latex: str(5000) } },
};

const MARKS: Record<string, Record<string, AttrRule>> = {
  bold: {},
  italic: {},
  underline: {},
  strike: {},
  code: {},
  link: {
    href,
    target: nullable(pattern(/^_blank$/)),
    rel: () => 'noopener noreferrer nofollow',
    class: () => null,
    title: nullable(str(500)),
  },
  textStyle: { color: nullable(pattern(COLOR)), backgroundColor: nullable(pattern(COLOR)), fontSize },
  highlight: { color: nullable(pattern(COLOR)) },
};

function cleanAttrs(raw: unknown, rules: Record<string, AttrRule>, where: string) {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException(`Invalid attrs on ${where}`);
  const out: Json = {};
  for (const [key, rule] of Object.entries(rules)) {
    if (!(key in (raw as Json))) continue;
    const value = rule((raw as Json)[key]);
    if (value !== undefined) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

export function sanitizeNoteContent(input: unknown): NoteDoc {
  let count = 0;

  const walk = (node: unknown, depth: number): Json => {
    if (++count > MAX_NODES) throw new BadRequestException('Note is too large');
    if (depth > MAX_DEPTH) throw new BadRequestException('Note is nested too deeply');
    if (!node || typeof node !== 'object' || Array.isArray(node)) throw new BadRequestException('Invalid note content');
    const n = node as Json;
    const type = n.type;
    if (typeof type !== 'string' || !(type in NODES)) throw new BadRequestException(`Unsupported block type: ${String(type).slice(0, 40)}`);
    if (depth === 0 && type !== 'doc') throw new BadRequestException('Note content must be a doc');

    const out: Json = { type };
    const attrs = cleanAttrs(n.attrs, NODES[type].attrs ?? {}, type);
    if (attrs) out.attrs = attrs;
    if (type === 'inlineMath' || type === 'blockMath') {
      if (typeof attrs?.latex !== 'string') throw new BadRequestException('Formula is missing or too long');
    }

    if (type === 'text') {
      if (typeof n.text !== 'string' || n.text.length === 0 || n.text.length > 100_000) throw new BadRequestException('Invalid text');
      out.text = n.text;
    }

    if (n.marks !== undefined) {
      if (!Array.isArray(n.marks) || n.marks.length > 20) throw new BadRequestException('Invalid marks');
      const marks = n.marks.map((m) => {
        const mark = m as Json;
        if (!mark || typeof mark.type !== 'string' || !(mark.type in MARKS)) {
          throw new BadRequestException(`Unsupported text style: ${String(mark?.type).slice(0, 40)}`);
        }
        const markAttrs = cleanAttrs(mark.attrs, MARKS[mark.type], mark.type);
        if (mark.type === 'link' && !markAttrs?.href) return null; // unsafe link: keep the text, drop the link
        return markAttrs ? { type: mark.type, attrs: markAttrs } : { type: mark.type };
      }).filter(Boolean);
      if (marks.length) out.marks = marks;
    }

    if (n.content !== undefined) {
      if (!Array.isArray(n.content)) throw new BadRequestException('Invalid note content');
      if (NODES[type].inline && type !== 'text') throw new BadRequestException(`${type} cannot have content`);
      out.content = n.content.map((child) => walk(child, depth + 1));
    }
    return out;
  };

  return walk(input, 0) as unknown as NoteDoc;
}

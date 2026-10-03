import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { BackgroundColor, Color, FontSize, TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Mathematics } from '@tiptap/extension-mathematics';
import { Placeholder } from '@tiptap/extensions';
import 'katex/dist/katex.min.css';
import { api, uploadImage } from '../../lib/api.js';
import MathDialog from './MathDialog.jsx';

export const TEXT_COLORS = [
  ['Default', null], ['Gray', '#787774'], ['Brown', '#9f6b53'], ['Orange', '#d9730d'], ['Yellow', '#cb912f'],
  ['Green', '#448361'], ['Blue', '#337ea9'], ['Purple', '#9065b0'], ['Pink', '#c14c8a'], ['Red', '#d44c47'],
];
export const HIGHLIGHTS = [
  ['None', null], ['Gray', '#f1f1ef'], ['Brown', '#f4eeee'], ['Orange', '#fbecdd'], ['Yellow', '#fbf3db'],
  ['Green', '#edf3ec'], ['Blue', '#e7f3f8'], ['Purple', '#f6f3f9'], ['Pink', '#faf1f5'], ['Red', '#fdebec'],
];
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '40px', '48px'];
const ACCEPTED_IMAGES = 'image/png,image/jpeg,image/gif,image/webp';
const SAVE_DELAY_MS = 700;

export default function NoteEditor({ note, onTitleChange }) {
  const [title, setTitle] = useState(note.title);
  const [status, setStatus] = useState('saved'); // saved | saving | unsaved | error
  const [error, setError] = useState(null);
  const [math, setMath] = useState(null); // { display, latex, pos? }
  const [slash, setSlash] = useState(null); // { from, query, x, y, index }
  const fileRef = useRef(null);
  const pending = useRef({});
  const timer = useRef(null);
  const editorRef = useRef(null);

  // --- Autosave -------------------------------------------------------------
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const body = pending.current;
    if (!Object.keys(body).length) return;
    pending.current = {};
    setStatus('saving');
    try {
      await api(`/notes/${note.id}`, { method: 'PUT', body });
      setStatus((s) => (s === 'saving' && !Object.keys(pending.current).length ? 'saved' : s));
      setError(null);
    } catch (err) {
      pending.current = { ...body, ...pending.current }; // retry with the next change
      setStatus('error');
      setError(err.message);
    }
  }, [note.id]);

  const queue = useCallback((patch) => {
    Object.assign(pending.current, patch);
    setStatus('unsaved');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [flush]);

  useEffect(() => {
    const beforeUnload = (e) => { if (Object.keys(pending.current).length) { flush(); e.preventDefault(); } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { window.removeEventListener('beforeunload', beforeUnload); flush(); };
  }, [flush]);

  // --- Images -----------------------------------------------------------------
  const insertImages = useCallback(async (files, pos) => {
    const images = [...files].filter((f) => ACCEPTED_IMAGES.split(',').includes(f.type));
    if (!images.length) return false;
    for (const file of images) {
      if (file.size > 5 * 1024 * 1024) { setError(`${file.name} is larger than 5 MB`); continue; }
      try {
        setStatus('saving');
        const { url } = await uploadImage(file);
        const ed = editorRef.current;
        const node = ed.schema.nodes.image.create({ src: url, alt: file.name.replace(/\.[^.]+$/, '').slice(0, 200) });
        const at = pos ?? ed.state.selection.from;
        ed.chain().focus().insertContentAt(at, node.toJSON()).run();
      } catch (err) {
        setError(err.message);
        setStatus('error');
      }
    }
    return true;
  }, []);

  // --- Editor -------------------------------------------------------------------
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https', protocols: ['http', 'https', 'mailto'], HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' } },
      }),
      TextStyle,
      Color,
      BackgroundColor,
      FontSize,
      Highlight.configure({ multicolor: true }),
      Image.configure({ resize: { enabled: true, minWidth: 80, minHeight: 40, alwaysPreserveAspectRatio: true } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Mathematics.configure({
        katexOptions: { throwOnError: false, trust: false },
        inlineOptions: { onClick: (node, pos) => setMath({ display: false, latex: node.attrs.latex, pos }) },
        blockOptions: { onClick: (node, pos) => setMath({ display: true, latex: node.attrs.latex, pos }) },
      }),
      Placeholder.configure({ placeholder: "Write something, or type '/' for commands…" }),
    ],
    content: note.content,
    editorProps: {
      attributes: { class: 'note-content', spellcheck: 'true' },
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files;
        if (files?.length) { insertImages(files); return true; }
        return false;
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = event.dataTransfer?.files;
        if (moved || !files?.length) return false;
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        insertImages(files, pos);
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      queue({ content: ed.getJSON() });
      updateSlash(ed);
    },
    onSelectionUpdate: ({ editor: ed }) => updateSlash(ed),
  }, [note.id]);
  editorRef.current = editor;

  // --- "/" command menu ---------------------------------------------------------
  function updateSlash(ed) {
    const { from, empty } = ed.state.selection;
    const before = ed.state.doc.textBetween(Math.max(0, from - 30), from, '\n', '\n');
    const m = empty ? /(?:^|\s)\/([a-z0-9 ]{0,20})$/i.exec(before) : null;
    if (!m) return setSlash(null);
    const coords = ed.view.coordsAtPos(from);
    setSlash((s) => ({ from: from - m[1].length - 1, query: m[1].toLowerCase(), x: coords.left, y: coords.bottom, index: s?.query === m[1].toLowerCase() ? s.index : 0 }));
  }

  const commands = useMemo(() => [
    { label: 'Text', keys: 'text paragraph', run: (c) => c.setParagraph() },
    { label: 'Heading 1', keys: 'h1 heading title', run: (c) => c.setHeading({ level: 1 }) },
    { label: 'Heading 2', keys: 'h2 heading', run: (c) => c.setHeading({ level: 2 }) },
    { label: 'Heading 3', keys: 'h3 heading', run: (c) => c.setHeading({ level: 3 }) },
    { label: 'Bulleted list', keys: 'bullet list ul', run: (c) => c.toggleBulletList() },
    { label: 'Numbered list', keys: 'numbered ordered list ol', run: (c) => c.toggleOrderedList() },
    { label: 'To-do list', keys: 'todo task check', run: (c) => c.toggleTaskList() },
    { label: 'Quote', keys: 'quote blockquote', run: (c) => c.toggleBlockquote() },
    { label: 'Code block', keys: 'code block', run: (c) => c.toggleCodeBlock() },
    { label: 'Divider', keys: 'divider hr line', run: (c) => c.setHorizontalRule() },
    { label: 'Photo', keys: 'image photo picture upload', run: (c) => { c.run(); fileRef.current?.click(); return null; } },
    { label: 'Inline formula', keys: 'math formula inline latex equation', run: (c) => { c.run(); setMath({ display: false, latex: '' }); return null; } },
    { label: 'Block formula', keys: 'math formula block latex equation', run: (c) => { c.run(); setMath({ display: true, latex: '' }); return null; } },
  ], []);

  const slashItems = slash ? commands.filter((c) => !slash.query || c.label.toLowerCase().includes(slash.query) || c.keys.includes(slash.query)) : [];

  function runSlash(item) {
    const chain = editor.chain().focus().deleteRange({ from: slash.from, to: editor.state.selection.from });
    const next = item.run(chain);
    if (next) next.run();
    setSlash(null);
  }

  useEffect(() => {
    if (!slash || !editor) return;
    const onKey = (e) => {
      if (!slashItems.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const d = e.key === 'ArrowDown' ? 1 : -1;
        setSlash((s) => ({ ...s, index: (s.index + d + slashItems.length) % slashItems.length }));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        runSlash(slashItems[Math.min(slash.index, slashItems.length - 1)]);
      } else if (e.key === 'Escape') {
        setSlash(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // --- Formulas -------------------------------------------------------------------
  function saveMath(latex) {
    const c = editor.chain().focus();
    if (math.pos !== undefined) {
      (math.display ? c.updateBlockMath({ latex, pos: math.pos }) : c.updateInlineMath({ latex, pos: math.pos })).run();
    } else {
      (math.display ? c.insertBlockMath({ latex }) : c.insertInlineMath({ latex })).run();
    }
    setMath(null);
  }

  function deleteMath() {
    const node = editor.state.doc.nodeAt(math.pos);
    if (node) editor.chain().focus().deleteRange({ from: math.pos, to: math.pos + node.nodeSize }).run();
    setMath(null);
  }

  if (!editor) return null;

  return (
    <div className="note-editor">
      <div className="note-head">
        <input
          className="note-title"
          value={title}
          maxLength={200}
          placeholder="Untitled"
          aria-label="Page title"
          onChange={(e) => { setTitle(e.target.value); onTitleChange(e.target.value); queue({ title: e.target.value }); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editor.commands.focus('start'); } }}
        />
        <SaveStatus status={status} />
      </div>

      <Toolbar editor={editor} onImage={() => fileRef.current?.click()} onMath={(display) => setMath({ display, latex: '' })} />
      {error && <p className="banner error" role="alert">{error} <button className="link" onClick={() => setError(null)}>Dismiss</button></p>}

      <EditorContent editor={editor} />

      <input
        ref={fileRef} type="file" accept={ACCEPTED_IMAGES} multiple hidden
        onChange={(e) => { insertImages(e.target.files); e.target.value = ''; }}
      />

      {slash && slashItems.length > 0 && (
        <ul className="slash-menu" style={{ left: slash.x, top: slash.y + 6 }} role="listbox" aria-label="Insert block">
          {slashItems.map((item, i) => (
            <li key={item.label}>
              <button
                type="button" role="option" aria-selected={i === slash.index}
                className={i === slash.index ? 'active' : undefined}
                onMouseDown={(e) => { e.preventDefault(); runSlash(item); }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {math && (
        <MathDialog
          initial={math.latex}
          display={math.display}
          editing={math.pos !== undefined}
          onSave={saveMath}
          onDelete={deleteMath}
          onClose={() => { setMath(null); editor.commands.focus(); }}
        />
      )}
    </div>
  );
}

function SaveStatus({ status }) {
  const label = { saved: 'Saved', saving: 'Saving…', unsaved: 'Editing…', error: 'Not saved' }[status];
  return <span className={`save-status ${status}`} role="status">{label}</span>;
}

// --- Toolbar ----------------------------------------------------------------------

function Toolbar({ editor, onImage, onMath }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive('heading', { level: 1 }) ? 'h1' : e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : 'p',
      fontSize: e.getAttributes('textStyle').fontSize ?? '',
      color: e.getAttributes('textStyle').color ?? null,
      highlight: e.getAttributes('highlight').color ?? null,
      bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), strike: e.isActive('strike'), code: e.isActive('code'),
      bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), task: e.isActive('taskList'),
      quote: e.isActive('blockquote'), codeBlock: e.isActive('codeBlock'), link: e.isActive('link'),
      canUndo: e.can().undo(), canRedo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();

  function setBlock(v) {
    if (v === 'p') c().setParagraph().run();
    else c().setHeading({ level: Number(v[1]) }).run();
  }

  function setLink() {
    const prev = editor.getAttributes('link').href ?? '';
    const url = window.prompt('Link address (https://…)', prev);
    if (url === null) return;
    if (url === '') return c().extendMarkRange('link').unsetLink().run();
    if (!/^(https?:\/\/|mailto:)/i.test(url)) return window.alert('Links must start with https://, http:// or mailto:');
    c().extendMarkRange('link').setLink({ href: url }).run();
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <Btn label="Undo" disabled={!s.canUndo} onClick={() => c().undo().run()}>↶</Btn>
      <Btn label="Redo" disabled={!s.canRedo} onClick={() => c().redo().run()}>↷</Btn>
      <Sep />
      <select aria-label="Text style" value={s.block} onChange={(e) => setBlock(e.target.value)}>
        <option value="p">Text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <select
        aria-label="Font size" value={s.fontSize}
        onChange={(e) => (e.target.value ? c().setFontSize(e.target.value).run() : c().unsetFontSize().run())}
      >
        <option value="">Size</option>
        {FONT_SIZES.map((f) => <option key={f} value={f}>{parseInt(f, 10)}</option>)}
      </select>
      <Sep />
      <Btn label="Bold (Ctrl+B)" active={s.bold} onClick={() => c().toggleBold().run()}><b>B</b></Btn>
      <Btn label="Italic (Ctrl+I)" active={s.italic} onClick={() => c().toggleItalic().run()}><i>I</i></Btn>
      <Btn label="Underline (Ctrl+U)" active={s.underline} onClick={() => c().toggleUnderline().run()}><u>U</u></Btn>
      <Btn label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()}><s>S</s></Btn>
      <Btn label="Inline code" active={s.code} onClick={() => c().toggleCode().run()}>{'</>'}</Btn>
      <Palette
        label="Text color" swatches={TEXT_COLORS} value={s.color} kind="text"
        onPick={(v) => (v ? c().setColor(v).run() : c().unsetColor().run())}
      />
      <Palette
        label="Highlight" swatches={HIGHLIGHTS} value={s.highlight} kind="bg"
        onPick={(v) => (v ? c().setHighlight({ color: v }).run() : c().unsetHighlight().run())}
      />
      <Sep />
      <Btn label="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()}>•≡</Btn>
      <Btn label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()}>1≡</Btn>
      <Btn label="To-do list" active={s.task} onClick={() => c().toggleTaskList().run()}>☑</Btn>
      <Btn label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()}>❝</Btn>
      <Btn label="Code block" active={s.codeBlock} onClick={() => c().toggleCodeBlock().run()}>{'{ }'}</Btn>
      <Btn label="Divider" onClick={() => c().setHorizontalRule().run()}>―</Btn>
      <Sep />
      <Btn label="Link" active={s.link} onClick={setLink}>🔗</Btn>
      <Btn label="Photo" onClick={onImage}>🖼</Btn>
      <Btn label="Inline formula" onClick={() => onMath(false)}>∑</Btn>
      <Btn label="Block formula" onClick={() => onMath(true)}>∫ₐᵇ</Btn>
    </div>
  );
}

function Btn({ label, active, disabled, onClick, children }) {
  return (
    <button
      type="button" className={`tool ${active ? 'active' : ''}`} title={label} aria-label={label}
      aria-pressed={active === undefined ? undefined : active} disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="tool-sep" aria-hidden="true" />;

function Palette({ label, swatches, value, kind, onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="palette" ref={ref}>
      <button
        type="button" className="tool" title={label} aria-label={label} aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}
      >
        {kind === 'text'
          ? <span className="palette-a" style={{ color: value ?? undefined }}>A</span>
          : <span className="palette-a" style={{ background: value ?? 'transparent' }}>ab</span>}
        <span className="caret">▾</span>
      </button>
      {open && (
        <div className="palette-pop" role="menu" aria-label={label}>
          {swatches.map(([name, color]) => (
            <button
              key={name} type="button" role="menuitem" title={name}
              className={`swatch-btn ${value === color ? 'current' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onPick(color); setOpen(false); }}
            >
              {kind === 'text'
                ? <span className="swatch-a" style={{ color: color ?? undefined }}>A</span>
                : <span className="swatch-a bg" style={{ background: color ?? 'transparent' }} />}
              <span>{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

# SQL Academy

An interactive SQL course: 67 concept pages, from the first `SELECT` to data engineering patterns, plus a page of recommended Udemy SQL courses (`#/courses`) mapped to the chapters. Each page has:
- a full explanation;
- comparison tables and diagrams;
- editable examples you can run;
- exercises checked automatically;
- interview questions.

A real PostgreSQL ([PGlite](https://pglite.dev), Postgres compiled to WebAssembly) runs in the browser, so there's no server and nothing to install.

```bash
npm install
npm run dev      # http://localhost:5174
npm test         # runs every example and exercise solution against PGlite
npm run build    # static site in dist/
```

## How it works

| Path | Role |
| --- | --- |
| `src/content/*.js` | The course: one file per chapter, one object per concept page. `index.js` orders the chapters and gives each one a colour (`hue`) |
| `src/data/setup.sql` | The practice database (a Paris bike shop). It's a copy of `study-notes/sql/setup.sql`, so keep the two in sync |
| `src/db.js` | The in-browser PostgreSQL. Scripts run statement by statement, like psql (see `sqlsplit.js`); `compare()` checks exercise answers inside a rolled-back transaction |
| `src/components/` | The page renderer (`Blocks.jsx`), the runnable editor (`SqlRunner.jsx`), exercises (`Practice.jsx`) and the SVG diagrams |

A concept page's `body` is a list of blocks:
- `{ p }`: a paragraph;
- `{ h }`: a heading;
- `{ list }` and `{ steps }`: lists;
- `{ sql, title, note }`: a runnable example. Add `expectError: true` when the example is meant to fail;
- `{ table: { head, rows } }`: a comparison table. Cells starting with `+ `, `- ` or `~ ` are shown as good, bad or partial;
- `{ callout: 'trap' | 'tip' | 'de' | 'note' | 'analogy', text }`: a highlighted box;
- `{ diagram }`: one of the SVG diagrams.

Text supports `` `code` ``, `**bold**`, `*italic*` and `[links](#/c/concept-id)`.

Each exercise is `{ q, solution, hint?, ordered?, setup? }`. Use `setup: true` when the solution relies on objects created by the page's examples.

`npm test` checks every page on a fresh database:
- every example succeeds, or fails if it is marked `expectError`;
- every solution runs;
- the answer checker accepts each solution and rejects a wrong answer.

Run it after any content change.

## Deploying

The build is static: deploy `dist/` to Vercel, Netlify or GitHub Pages. PGlite downloads its WebAssembly bundle (about 3 MB compressed) the first time the page loads.

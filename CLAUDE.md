# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What's here

Two independent things share this folder:

1. **DE100 Tracker** — a tracker for a 100-day data-engineering study program: `backend/` (NestJS API), `web/` (React + Vite), `extension/` (Chrome MV3, plain JS, no build). Web app and extension sign in to the same API account.
2. **`sql-portfolio/`** — 18 standalone SQL analytics projects (DuckDB + Python), meant to be published as its own GitHub repo. Unrelated to the tracker code.

## Commands

Tracker (run API and web together; `.claude/launch.json` defines `api` on :3000 and `web` on :5173):
```bash
npm --prefix backend run dev        # API, watch mode
npm --prefix web run dev            # web; Vite proxies /api -> localhost:3000
npm --prefix backend test           # vitest: unit (src/**/*.spec.ts) + e2e (test/**/*.e2e-spec.ts)
cd backend && npx vitest run test/notes.e2e-spec.ts      # single test file
npm --prefix web test               # plan data tests
npm --prefix web run build
```
Backend type-check: `npx tsc -p tsconfig.json --noEmit` (from `backend/`).

SQL portfolio (use its venv: `sql-portfolio/.venv/Scripts/python`; set `PYTHONIOENCODING=utf-8` on Windows or DuckDB box-drawing output crashes the console):
```bash
python run_all.py                          # all 18: download -> load -> analyze -> charts
python run_all.py 04-paris-real-estate     # one project
python projects/<name>/visualize.py        # re-render charts from existing results/
```

## Backend architecture (`backend/`)

- **NestJS 11 + TypeScript 5.9, CommonJS — pinned on purpose.** NestJS 12 is ESM-only and TS 7 breaks the toolchain; don't upgrade. Tests use **Vitest with `unplugin-swc`** (esbuild drops decorator metadata Nest DI needs; Jest hangs on PGlite).
- **Database:** Postgres via Drizzle when `DATABASE_URL` is set, otherwise **embedded PGlite** in `backend/.data/` (tests use `PGLITE_DIR=memory`). `src/db/database.ts` abstracts both.
- **Migrations are plain SQL** in `backend/migrations/NNNN_*.sql`, applied in order at startup and tracked in `schema_migrations`. `src/db/schema.ts` is a Drizzle *mirror* — the SQL files are the source of truth; update both when changing tables.
- **Authorization is application-level:** every query in services is scoped by `userId` from the `AuthGuard` (no Postgres RLS). `test/isolation.e2e-spec.ts` and `test/notes.e2e-spec.ts` prove cross-user isolation — keep them passing.
- **Auth:** email + password (scrypt, `src/common/password.ts`), optional Google OAuth. Hand-rolled HS256 JWTs (`src/common/crypto.ts`), 15-min access tokens; refresh tokens are `<sessionId>.<secret>`, hashed in the `sessions` table, rotated on use with a 30 s grace window, replay → session revoked. Every request checks the session row, so revoking a session ("Connected devices") is instant. Web gets the refresh token as an httpOnly `SameSite=Strict` cookie on `/api/auth` (refresh also requires header `X-DE92-Client: web`); the extension gets it in the JSON body.
- **Live updates:** `EventsService` is in-process pub/sub exposed as SSE at `/api/events`; events only say what changed, clients refetch. Single-instance only.
- **Notes** (`src/notes/`): TipTap JSON content is validated by an allowlist sanitizer (`note-content.ts`) — add any new TipTap node/mark/attr there or saves will 400. Images are stored in Postgres (`note_images`), type-sniffed from bytes, served at `/api/images/:id?sig=<HMAC>` without auth.
- Config comes from env (`src/config.ts`, `.env` loaded in `main.ts`); production refuses to start without `JWT_SECRET` and `DATABASE_URL`. `RATE_LIMIT=off` disables throttling (tests).

## Web (`web/`)

- `src/lib/api.js` owns auth: access token in memory, refresh via cookie, auto-retry on 401, SSE over `fetch` (re-broadcast as `window` `de92-change` events).
- Hash routing in `App.jsx` (`#/tracker`, `#/notes/<id>`, …). The Notes page (TipTap + KaTeX) is lazy-loaded to keep the main bundle small.
- The 100-day program itself is static data in `src/data/plan.js`; day limits (1–100) must match backend validation and the `day_log` CHECK constraint.
- Vite's file watcher on Windows sometimes misses edits — restart the dev server if a page serves stale code.

## Extension (`extension/`)

Plain ES modules loaded unpacked. `config.js` (gitignored, copy of `config.example.js`) sets `API_URL`/`WEB_APP_URL`; `manifest.json` host_permissions must include the API host. All auth/sync runs in the service worker (`background.js`); Udemy progress is read by injecting `readProgressInPage` into an open udemy.com tab (undocumented Udemy endpoint — the likeliest thing to break). Server-side course matching is in `backend/src/tracker/match.ts` against `courses.keywords`.

## SQL portfolio (`sql-portfolio/`)

- Every project has the same contract: `run.py` (data `SOURCES`), `sql/01_load.sql` (run as one script), `sql/02_analysis.sql` (queries separated by `-- name: <id>` markers; each result saved to `results/<id>.csv`), `visualize.py` (reads `results/`, writes `images/`). Shared code in `toolkit/` (`pipeline.py`, `charts.py`).
- SQL runs with the project folder as cwd, so paths are `data/...`. `data/` and `*.duckdb` are gitignored; `results/` and `images/` are committed.
- Charts must go through `toolkit.charts.style()`/`save()` (header, source line, validated palette). Bars start at zero; use dot/line charts for non-zero baselines.
- README findings must match `results/` — re-verify numbers with a query after changing any SQL.

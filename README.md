# DE100 Tracker

A tracker for the 100-day Data Engineering program: a web app with the day-by-day plan, notes and course progress, a Chrome extension that syncs your Udemy course progress, and a NestJS API that both of them sign in to.

```
Chrome extension ──(titles + % only)──┐
                                      ▼
                        NestJS API  ──  PostgreSQL
                                      ▲   (embedded PGlite in dev)
Web app (React) ──── /api proxy ──────┘   live updates via Server-Sent Events
```

| Folder | What's in it |
| --- | --- |
| `backend/` | NestJS API: auth, sessions, tracker endpoints, SSE, SQL migrations, tests |
| `web/` | React + Vite web app: sign-in, 100-day grid, Notion-style notes, courses, connected devices, account/GDPR, privacy policy |
| `extension/` | Chrome Manifest V3 extension, plain JavaScript with no build step |

## Run it locally

No Docker needed. With no `DATABASE_URL`, the API uses an embedded Postgres (PGlite) stored in `backend/.data/`.

```bash
cd backend && npm install && npm run dev
```
```bash
cd web && npm install && npm run dev
```

Open http://localhost:5173, click **Create an account**, and choose a password (8+ characters). No email is sent.

To use real Postgres instead:
```bash
docker run -d --name de92-db -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:17
```
Then set `DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres` in `backend/.env` (copy `backend/.env.example`). Migrations run automatically on startup.

## API

All routes are under `/api`. Everything except `auth/*` and `health` needs `Authorization: Bearer <accessToken>`.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `auth/register` | Create an account `{email, password}` and start a web session |
| POST | `auth/login` | `{email, password, client}` (`web` or `extension`) for a session |
| POST | `auth/password` | Change password `{currentPassword, newPassword}`; signs out other sessions |
| POST | `auth/refresh` | Rotate the refresh token (web: httpOnly cookie + `X-DE92-Client: web`; extension: body) |
| POST | `auth/logout` | Revoke the current session |
| GET | `auth/google/start`, `auth/google/callback` | Google sign-in (optional) |
| POST | `auth/token` | Extension: redeem the Google one-time code with its PKCE verifier |
| GET / PATCH / DELETE | `me` | Snapshot (profile, courses, progress, days, sessions) / update profile / delete account |
| GET | `me/export` | GDPR export as JSON |
| PUT | `days/:day` | `{done?, notes?}` for day 1–100 |
| PUT | `progress/:courseId` | `{percent}` 0–100 (manual) |
| POST | `sync` | Extension only: `{items: [{udemyId?, title, percent}]}` → matched courses |
| GET / DELETE | `sessions`, `sessions/:id` | Connected devices; delete = disconnect |
| POST | `sessions/revoke-others` | Sign out everywhere else |
| GET | `events` | Server-Sent Events: "something changed" notifications |
| GET / POST | `notes` | List pages / create one `{title?, parentId?}` |
| GET / PUT / DELETE | `notes/:id` | Read / autosave `{title?, icon?, content?}` / delete with sub-pages |
| PATCH | `notes/:id/move` | `{parentId, position}` (refuses cycles) |
| POST | `notes/images` | Upload a photo (multipart `file`, PNG/JPEG/GIF/WebP, max 4 MB) |
| GET | `images/:id?sig=…` | Serve a photo; the HMAC-signed URL is the permission |

## Notes

The **Notes** tab is a Notion-style editor (TipTap) with nested pages and page icons, headings, text colors and highlights, font sizes (12–48 px), bold/italic/underline/strike, lists and to-dos, quotes, code blocks, links, **photos** (upload button, paste, or drag and drop; resizable) and **math formulas** (inline or block, written in LaTeX with a live KaTeX preview and templates). Type `/` in a page for quick commands. Changes autosave.

Content is stored as TipTap JSON and checked on the server by an allowlist (`backend/src/notes/note-content.ts`): unknown blocks are rejected, colors, sizes and links must match strict patterns, and images must be ones uploaded to your notes. Photos are type-checked by their bytes (SVG is refused), limited to 4 MB each and 200 MB per account, and served with `sandbox` CSP. Notes and photos are included in the data export and deleted with the account.

## Security

- **Every query is scoped to the signed-in user's id.** `test/isolation.e2e-spec.ts` proves another user can't read, change, export or revoke your data. Removing a single scope makes it fail.
- **Sessions are real database rows.** Each request checks its session, so Disconnect and logout take effect immediately. Access tokens last 15 minutes. Refresh tokens rotate on every use; replaying an old one revokes the session, with a 30-second grace window so parallel tabs don't log you out.
- **The web app never sees its refresh token.** It's an `httpOnly`, `SameSite=Strict` cookie scoped to `/api/auth`, and refreshing also requires a custom header, which blocks CSRF. The access token is kept in memory only.
- **Passwords:** 8–128 characters, stored only as scrypt hashes. The account locks for 15 minutes after 10 wrong attempts, and login is rate-limited per IP. A wrong password and an unknown email get the same error and take the same time. Changing the password signs out every other session. Email addresses are not verified, so an account only proves the person knows its password.
- **Google:** state is stored server-side and single-use, and the ID token's signature, issuer, audience, expiry and `email_verified` are all verified. The extension flow is PKCE-bound and only redirects to exact `https://<EXTENSION_IDS>.chromiumapp.org/auth` URLs.
- **Validation twice:** DTOs reject unknown fields and out-of-range values (percent 0–100, day 1–100, notes ≤ 2000 characters), and database CHECK constraints enforce the same rules.
- **Hardening:** Helmet headers, per-route rate limits, a 200 KB body limit, CORS limited to the web app and your extension IDs, and a strict CSP on the web app (`web/vercel.json`).
- **The extension never touches Udemy credentials.** It reads progress inside your open udemy.com tab, and only titles and percentages leave the browser.
- **GDPR:** privacy policy page, data export, and account deletion that cascades to all your data.

## Tests

```bash
cd backend && npm test
```
This runs 36 tests: title matching, user isolation, validation, registration, login, lockout, password change, cookie refresh, token rotation and replay detection, disconnect, sign-out-others, live events, account deletion, rate limiting, and notes (privacy, content sanitizing, photo uploads and signed URLs, sub-pages). They run against an in-memory database. To run them against a real, empty PostgreSQL instead (as in production):
```bash
cd backend && TEST_DATABASE_URL=postgresql://user@localhost:5432/de100_test npm test
```

```bash
cd web && npm test
```
This checks the 100-day plan data: 100 days, Build & Share days, 14 posts in order, and the current-day calculation.

## Chrome extension

1. Copy `extension/config.example.js` to `extension/config.js` and set `API_URL` and `WEB_APP_URL` (in production: `https://<your-app>.vercel.app/api` and `https://<your-app>.vercel.app`).
2. In `extension/manifest.json`, set `host_permissions` to Udemy plus your API host (`http://localhost:3000/*` for dev, your Vercel domain in production).
3. Open `chrome://extensions`, enable Developer mode, click **Load unpacked**, and choose `extension/`.
4. Add the extension ID to `EXTENSION_IDS` in `backend/.env` (needed for Google sign-in and CORS).
5. Create your account in the web app first, then sign in from the popup with the same email and password and click **Sync Udemy progress**.

## Deploying (Vercel + Render + Neon)

```
browser ──> Vercel (web app, static) ──/api/*──> Render (NestJS API) ──> Neon (PostgreSQL)
```
The browser only talks to the Vercel domain: `web/vercel.json` forwards `/api/*` to Render, so the refresh cookie stays first-party.

1. **Database, Neon:** create a free project in an EU region (Frankfurt) and copy its connection string. Keep `?sslmode=require`.
2. **API, Render:** *New → Blueprint*, pick this GitHub repo; `render.yaml` defines the service (`backend/`, Node 24, health check `/api/health`, a generated `JWT_SECRET`). Fill in the prompted variables:
   - `DATABASE_URL`: the Neon string
   - `WEB_ORIGIN`: your Vercel URL, e.g. `https://de100-tracker.vercel.app`
   - `API_PUBLIC_URL`: the same URL followed by `/api`

   Migrations run automatically at startup.
3. **Web, Vercel:** *Add New → Project*, import the repo, set **Root Directory = `web`**. Vite is auto-detected. If Render gave the API a different URL than `de100-tracker-api.onrender.com`, update the rewrite in `web/vercel.json`.
4. Open the Vercel URL and create your account.

Notes:
- Render's free tier sleeps after 15 minutes idle: the first request after a pause takes about 30–50 seconds.
- Photos are limited to 4 MB because Vercel caps proxied request bodies at 4.5 MB.
- `TRUST_PROXY_HOPS=2` (Vercel + Render) lets rate limiting see the real client IP.
- The API refuses to start in production without `JWT_SECRET` and `DATABASE_URL`.

- **Google (optional):** create an OAuth client of type "Web application" with the redirect URI `${API_PUBLIC_URL}/auth/google/callback`, and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- **Scaling beyond one API instance:** live events are in-process, so swap `EventsService` for Postgres `LISTEN/NOTIFY` or Redis first.

## Caveats

- **Udemy's API is internal and undocumented.** The extension reads `/api-2.0/users/me/subscribed-courses` (`completion_ratio`) and hasn't been tested against a real account yet. If it breaks, update `readProgressInPage` in `extension/lib/udemy.js`.
- **Course matching** uses the lowercase keyword phrases in `backend/migrations/0002_courses.sql`. Add a migration that sets `udemy_course_id` for an exact match.
- Before publishing, fill in the controller, host and contact placeholders in `web/src/components/Privacy.jsx`.

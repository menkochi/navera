# V10 Project Review

Reviewed on 2026-04-30. Scope: `src/att_v10_uat.tsx` as the current main page, plus the supporting files it imports or depends on: `src/App.tsx`, `src/main.tsx`, `src/pages/LoginPage.tsx`, `src/components/ProtectedRoute.tsx`, `src/lib/supabase.ts`, `src/index.css`, `vite.config.ts`, `package.json`, `tsconfig*.json`, `eslint.config.js`, and `vercel.json`.

## Checks Run

- `npm run build`: passes. Vite warns that the main JS chunk is large: `874.90 kB` minified, `258.15 kB` gzip.
- `npm run lint`: fails because ESLint scans older and backup files as well as `src`.
- Scoped lint for V10/supporting files:
  `npx eslint src/att_v10_uat.tsx src/App.tsx src/main.tsx src/pages/LoginPage.tsx src/components/ProtectedRoute.tsx src/lib/supabase.ts`
  fails with 8 errors and 1 warning, all in `src/att_v10_uat.tsx`.

## High Priority

### 1. TypeScript is disabled on the main V10 file

File: `src/att_v10_uat.tsx:1`

The file starts with `// @ts-nocheck`, so the build does not type-check the largest and most important part of the app. This hides real problems such as implicit `any`, shape mismatches between Supabase rows and UI state, missing properties, invalid event types, and nullable values.

The scoped ESLint run flags this directly:

- `@typescript-eslint/ban-ts-comment`: Do not use `@ts-nocheck`.

This is risky because `npm run build` can pass even while V10 contains TypeScript errors.

### 2. Saved rich text is rendered with raw HTML

File: `src/att_v10_uat.tsx:529-540`

`RichContent` uses `dangerouslySetInnerHTML` with stored content from targets and session notes. The content usually comes from Tiptap, but it is persisted in Supabase and later rendered without sanitization. If unsafe HTML gets into the database through import, manual DB edits, a compromised client, or a future feature, it could run in the therapist's browser.

Recommendation: sanitize saved/rendered HTML with a trusted sanitizer such as DOMPurify, or store a constrained Tiptap JSON document instead of rendering arbitrary HTML.

### 3. Session and EHCP totals are inaccurate until the Sessions tab is opened

Files:

- `src/att_v10_uat.tsx:993-999`
- `src/att_v10_uat.tsx:1023-1028`
- `src/att_v10_uat.tsx:1577-1587`

`ChildProfile` calculates session count, delivered hours, and EHCP percentage from `child.sessionsLogged`. But sessions are only fetched inside `SessionsSection`, which only mounts when `section === "sessions"`.

Impact: when a user opens a child profile, the header can show `0` sessions, `0.0h`, and `0%` EHCP usage even if sessions exist in Supabase. The numbers become correct only after visiting the Sessions tab.

Recommendation: fetch session summaries when loading the child profile or load all needed session data alongside the selected child before displaying those stats.

### 4. `updateChild` causes unrelated autosave writes on every local child update

File: `src/att_v10_uat.tsx:651-667`

Every `updateChild` call patches `caseload_terms_uat` with only notes, lead, and RAG status. That means actions like loading sessions, adding/editing targets, changing EHCP hours, adding videos, or other local UI updates also send a term patch.

Potential effects:

- Extra network/database writes.
- False "Auto-save failed" toasts for operations that did not actually edit term notes/lead/RAG.
- Race conditions where an older async patch could overlap with a newer direct Supabase update.
- Harder debugging because one UI action can trigger multiple unrelated persistence operations.

Recommendation: split local state updates from persistence, or make `updateChild` accept explicit fields to persist.

## Medium Priority

### 5. The V10 scoped lint currently fails

File: `src/att_v10_uat.tsx`

Scoped lint errors:

- `src/att_v10_uat.tsx:1`: `@ts-nocheck` is banned.
- `src/att_v10_uat.tsx:170`: empty `catch` block in `lsSet`.
- `src/att_v10_uat.tsx:641`: empty `catch` block when parsing `slt_pending`.
- `src/att_v10_uat.tsx:1204`: `unhideTarget` is unused.
- `src/att_v10_uat.tsx:1221`: `hiddenTargets` is unused.
- `src/att_v10_uat.tsx:1579`: React compiler lint flags synchronous `setSessionsLoading(true)` inside an effect.
- `src/att_v10_uat.tsx:1583`: callback argument `c` is unused.
- `src/att_v10_uat.tsx:1587`: missing `updateChild` dependency in the sessions effect.
- `src/att_v10_uat.tsx:2283`: empty `catch` block after import refresh.

The broader `npm run lint` also fails because old/backup files are included in lint scope. Since the user asked not to worry about pre-V10 main pages, this should probably be handled by narrowing ESLint ignores or moving old snapshots outside lint scope.

### 6. Hidden/cleared target behavior is incomplete

File: `src/att_v10_uat.tsx:1194-1221`

`TargetList` initializes hidden IDs from `t.cleared`, but the UI only changes local `hiddenIds`. It does not update the `cleared` field in Supabase. `unhideTarget` and `hiddenTargets` are defined but unused, so users can hide items temporarily but cannot see a hidden list or restore individual hidden targets.

Impact: "Hide" is visual-only despite the data model having a `cleared` field, and the behavior resets on remount/refresh unless the target was already marked `cleared` in the database by some other path.

Recommendation: decide whether hide is intentionally session-only. If it should persist, add a `patchTargetCleared` operation and a visible restore flow.

### 7. Import depends on loading XLSX from a CDN at runtime

File: `src/att_v10_uat.tsx:2172-2179`

The import modal injects a script from `https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js`. This creates a runtime dependency on a third-party CDN, with no integrity check and no npm/package lock tracking.

Impact:

- Import fails offline or if the CDN is blocked by school/organisation filtering.
- A future Content Security Policy could break import.
- The dependency is outside the normal audit/build process.

Recommendation: install `xlsx` as a project dependency and import it through the bundle, or add a controlled lazy import with dependency tracking.

### 8. Supabase environment variables are not validated early

Files:

- `src/lib/supabase.ts:3-6`
- `src/att_v10_uat.tsx:42-48`

Both the Supabase client and the custom REST helper assume `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exist. If either is missing, the app can fail in confusing ways: `createClient` may throw or `supabaseFetch` may request `undefined/rest/v1/...`.

Recommendation: validate env vars once in `src/lib/supabase.ts` and fail with a clear message before rendering.

### 9. Login/protected route does not subscribe to auth changes

File: `src/components/ProtectedRoute.tsx:9-14`

`ProtectedRoute` checks the session once on mount. It does not subscribe to `supabase.auth.onAuthStateChange`.

Impact: if the session expires, is refreshed, or is signed out in another tab, this route may not react until a reload or navigation. V10's API calls can then fail with session errors while the route still appears signed in.

Recommendation: subscribe to auth state changes and clean up the subscription in the effect.

### 10. Latest-term selection ignores academic year

File: `src/att_v10_uat.tsx:216-224`

`dedupeByLatestTerm` ranks only term names from Autumn 1 to Summer 2. It does not consider year/academic year, created date, or updated date.

Impact: if the database contains multiple years of records for a child, "Summer 2" from an older year can outrank "Autumn 1" from a newer year, so the app may show stale caseload data.

Recommendation: include an academic year/date column in ordering and dedupe logic, or let Supabase return only the active/current term row.

## Lower Priority / Cleanup

### 11. V10 contains outdated setup comments

File: `src/att_v10_uat.tsx:13-39`

The top comment still says to install Tiptap and add CSS/font setup. Tiptap is already in `package.json`, and the CSS has already been added to `src/index.css`. This is not a runtime bug, but it makes the file look less production-ready.

### 12. Production bundle is large

Build output reports:

- `dist/assets/index-*.js`: `874.90 kB` minified
- gzip: `258.15 kB`

Likely contributors are the large single-page V10 component, Tiptap, Supabase, and the all-in-one route bundle.

Recommendation: code-split `/app`, lazy-load heavy modals/editors, and bundle the Excel parser only when import is opened.

### 13. `npm run lint` includes old and backup code

File: `package.json:9`, `eslint.config.js`

The lint script runs `eslint .`, so older files such as `src/att_v8_uat_BACKUP.tsx`, `src/att_v9_uat.tsx`, root-level backups, and `data/old` can fail the whole project even when the current app builds.

Recommendation: either archive old versions outside the linted tree or add explicit ignores for old snapshots/backups.

## Positive Notes

- `npm run build` completes successfully.
- Routing is wired to V10: `src/App.tsx` imports `./att_v10_uat` and protects `/app`.
- Tiptap dependencies are installed in `package.json`.
- Supabase CRUD paths are mostly centralized near the top of V10, which makes future cleanup easier.


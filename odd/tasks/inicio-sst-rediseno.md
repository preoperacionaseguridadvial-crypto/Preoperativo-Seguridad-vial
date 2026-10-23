# Inicio SST - rediseno

## Objective
Redesign the home page (`/`) seen by the SST role after login, following the reference mockup, without a sidebar.

## Problem / why
The current SST home is a narrow single column (greeting, daily summary, shortcuts, expirations). The SST administrator wants a corporate look consistent with the redesigned login: hero with the team photo, full name, role, three quick-access cards and the existing inspection metrics.

## Scope (authorized by the user on 2026-10-23)
- No sidebar. Keep the top header.
- Hero banner: welcome + FULL name (not first name) + role pill + short description + team photo (`public/login/equipo-seguridad.png`) + logo.
- Role pill reads "Administrador SST" followed by "Seguridad y Salud en el Trabajo".
- "Accesos rapidos": only three cards: Dashboard, Consulta, Administracion.
- Keep the existing inspection metrics (`ResumenDelDia`, the block under "Hoy").
- "Documentos de vehiculos" status card: "Al dia" when no active vehicle has expired/expiring SOAT or tecnomecanica, otherwise the existing expiration detail.
- Other roles keep their current home.

## Out of scope
- Sidebar, notification bell (no notifications model exists), new sections (Vehiculos, Recorredores, Reportes, Ayuda).
- Changing the global role label used in tables and other screens.

## Constraints
- Next.js 16 (read `node_modules/next/dist/docs/` before using APIs), Tailwind v4 tokens in `app/globals.css`, inline SVG icons (no icon library).
- UI copy in Spanish (existing project language).
- Strict TDD: on (source: orchestrator config "Strict TDD Mode: enabled"). Runner: `npm test` (vitest, node env, `**/*.test.ts` only; no component tests).

## Tasks
- [x] T1 - SST quick-access list reduced to Dashboard, Consulta, Administracion; role pill text helper with "Seguridad y Salud en el Trabajo"; vehicle documents summary count ("al dia" vs pending). Pure functions with tests first (RED -> GREEN). Route: delegated writer.
  - Evidence: RED `Tests 4 failed | 954 passed`; GREEN `Tests 961 passed (961)`. Parent spot check: `npx vitest run lib/inicio` 54 passed, `tsc --noEmit` clean.
- [x] T2 - SST home UI: hero, quick-access cards, metrics, documents status card; other roles unchanged. Route: delegated writer (2+ non-trivial files).
  - Evidence: lint clean; live curl as temporary SST user shows full name, role pill, 3 cards, metrics, "Al dia" card; DIRECTOR home unchanged. Warning state (pending documents) not seen live (no expiring docs in dev DB). Visual/responsive check pending (user).
  - Finding: removing the SST "habilitaciones" card leaves `/admin/habilitaciones` without any UI link (`/admin` redirects to `/admin/usuarios`). Pending user decision.
- [x] T3 - Live check on localhost (curl with SST login), `npm test`, `npm run lint`, typecheck; commit.
  - Accepted user changes (2026-10-23): hero = full-width photo background with text overlaid on the left and logo on a diagonal light panel (no bottom fade); SST home drops AppHeader (logo had no purpose) and shows a prominent "Cerrar sesion" pill below the banner; Gestion layout (dashboard, consulta) uses `AppHeader destacado` (no logo, prominent "Inicio" pill). Admin/supervisor/worker headers unchanged.
  - Evidence: `npm test` 73 files / 961 tests passed; `npm run lint` clean; `tsc --noEmit` clean. User approved the look visually on localhost.
- [ ] T4 - Decide access to `/admin/habilitaciones` (no UI link since the SST card was removed). Deferred by the user ("dejemos asi por ahora").

## Acceptance criteria
- SST login lands on `/` and sees: no sidebar, hero with full name and role pill including "Seguridad y Salud en el Trabajo", three cards, inspection metrics, documents status card.
- Other roles' home renders as before.
- `npm test`, lint and `tsc --noEmit` pass.

## Progress / evidence
- Branch `feat/inicio-sst-rediseno` created from `main` @ 26edfe1.

## Next step
Merge to `main` so Railway deploys; later, T4 (habilitaciones access).

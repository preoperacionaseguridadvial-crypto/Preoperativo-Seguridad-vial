# Consulta de inspecciones - rediseno

## Objective
Redesign `/consulta-inspecciones` following the user's mockup (2026-10-23): header with illustration, filters card, four summary tiles and a richer results list.

## Problem / why
The current page is a narrow single column with a plain form and a basic list; the SST administrator wants the same corporate look as the new SST home.

## Scope (authorized by the user on 2026-10-23)
- Header: eyebrow "INSPECCIONES", title "Todas las inspecciones", subtitle "Consulta, filtra y revisa el historial de inspecciones registradas.", decorative truck/road illustration (inline SVG, no new raster asset).
- "Filtros de busqueda" card: Conductor, Placa, Estado (select "Todos"), Desde, Hasta, "Buscar", "Limpiar filtros". Same GET params as today (`conductor`, `placa`, `estado`, `fechaDesde`, `fechaHasta`).
- Tiles: Total / Aprobadas / Pendientes / Canceladas, counted over the current filtered result set.
- "Resultados de inspecciones" + "N inspecciones encontradas"; rows: plate + "Placa", worker name, date, start - end time ("—" if no end), status pill, optional approval line (existing `estadoEtapaOleariari`), "Ver detalle".
- Applies to every role that can access the route (same page); SUPERVISOR_OLEARIARI keeps its forced `sede` filter.

## Decisions (defaults, reported to the user)
- States outside the mockup (EN_PROCESO, ENVIADA, RECHAZADA, NO_APTA_PARA_OPERAR) still show their own pill in rows; they count only in Total.
- "Pendientes" tile = PENDIENTE_APROBACION.
- Approval line only where it exists today (Oleariari); no invented text for Bogota.
- "Ver dashboard" link: shown only to roles allowed on `/dashboard` (today it shows to roles that get bounced).

## Out of scope
- Pagination, changing the query semantics, the detail page `[id]`.

## Constraints
- Next.js 16 (check `node_modules/next/dist/docs/`), Tailwind v4 tokens, inline SVG icons, Spanish UI copy.
- Strict TDD: on (orchestrator config). Runner: `npm test` (vitest, node env, `**/*.test.ts`).

## Tasks
- [x] T1 - Pure helpers with tests first: filter parsing (trim, invalid dates ignored, estado validation) and status counts/labels for tiles and pills. Route: delegated writer.
  - Evidence: `lib/inspections/filtros-consulta.ts` (+test). RED: test file failed to load; GREEN 10/10. Parent spot check: 10 passed.
- [x] T2 - Page UI redesign using the helpers. Route: delegated writer (same writer, 2+ non-trivial files).
  - Evidence: page rewritten + `_components/Iconos.tsx`, `IlustracionCamion.tsx`. `npm test` 74 files / 971 passed; tsc and lint clean. Live curl as temp SST: tiles 21/9/2/6 unfiltered, `?estado=APROBADA` 9/9/0/0, invalid date ignored. Visual check pending (user).
- [x] T2b - Accepted user changes: header truck illustration replaced by the ESS logo in the same 320x144 box (SVG deleted); "Ver PDF" button next to "Ver detalle" for SST on downloadable states. Rule extracted to `lib/inspections/pdf-acceso.ts` (`puedeDescargarPdf`), reused by the PDF route. Row uses a stretched "Ver detalle" link (no nested anchors). Route: inline.
  - Evidence: RED (module not found) -> GREEN 3/3; PDF route tests pass (8 total with helper); tsc and lint clean.
- [x] T2c - Bulk PDF download (user request 2026-10-23): button next to "Limpiar filtros" downloads ONE ZIP with one PDF per filtered inspection (same filters as the page). SST only; only states allowed by `puedeDescargarPdf`; streamed ZIP (`fflate`, new dependency) so a month of inspections doesn't sit in memory; cap 300 inspections per download with a clear message. Route: delegated writer (endpoint + helpers + button).
  - Evidence: `fflate` ^0.8.3; `lib/inspections/pdf-lote.ts` (+test), `app/api/inspecciones/pdf-lote/route.ts` (+test: 401, non-SST 404, none 404, 200 zip with EN_PROCESO/CANCELADA excluded). RED (modules missing) -> GREEN. Full suite 77 files / 988 passed; tsc, lint clean. Live: 13 PDFs zip OK (908 KB).
  - Timing: ~11 s/PDF through `next dev` (Turbopack overhead); measured outside dev with real dev-bucket photos: query 20-90 ms + photo fetch 50-120 ms + render 180-330 ms => ~0.5 s/PDF, so cap 300 ≈ 2-3 min in production. Kept 300.
  - Parent fix: stream `cancel()` stops rendering when the client aborts.
  - Not verified: >300 result set live, disabled button markup live, production timing.
- [ ] T3 - `npm test`, lint, tsc, live curl as SST; user visual check; commit.

## Acceptance criteria
- Page matches the mockup structure; filters keep working with the same URLs; tiles reflect the filtered set; detail link works.
- Tests, lint and typecheck pass.

## Progress / evidence
- Branch `feat/consulta-rediseno` from `main` @ dd6e957.

## Next step
T1.

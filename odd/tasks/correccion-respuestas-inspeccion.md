# Feature: correccion-respuestas-inspeccion

## Objective
Let the worker go back through the inspection steps and correct any answer while the inspection is still EN_PROCESO. Once it is sent (status != EN_PROCESO) nothing can be changed.

## Problem / Why
User (2026-10-07): "necesito tener un botón de devolver atrás en la inspección por si algún dato que marque lo quiero corregir... antes de que finalice; después de finalizada ya no se puede". Today the guided flow (`getNextStepPath`) only moves forward. Resolved documents become read-only (`DocumentoCheckItem`), and the documents list redirects away when nothing is pending.

## Scope (authorized by user)
- A visible "Atrás" control on every step of an EN_PROCESO inspection, going to the previous step in the real flow order. Order comes from `getNextStepPath`: kilometraje → documentos → checklist items one by one → declaración del conductor → fotos → resultado → confirmar/firmar.
- Revisiting an answered step shows the current answer preselected and lets the worker change it. Examples: item OK↔FALLA with novedad, documento resolved → "Cambiar", kilometraje, declaración, fotos (replace), resultado.
- Server-side rule stays the single source of truth: mutations only while EN_PROCESO (`getOwnInspeccionEnProceso`). After envío, pages are read-only / redirect as today.
- No schema changes.

## Constraints
- Next.js 16: Server Actions don't re-render on their own. Use `refresh()` / `revalidatePath()` / `redirect` (see `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/refresh.md`).
- Firma (signature) is the final act. Decide whether it is in scope: if a signature already exists on an EN_PROCESO inspection, report it as a gap, don't guess.
- TDD strict, runner `npx vitest run`. Pure step-order helper (`getPreviousStepPath` / step list) is tested first.
- Mobile-first, Spanish UI copy, design tokens from `app/globals.css`.

## Tasks
- [x] T1 — Step order helper + "Atrás" control on every step (route: delegated writer, mapping 4+ files)
- [ ] T2 — Re-answer checklist items and documents with the current value preselected; documents list reachable and editable while EN_PROCESO
- [ ] T3 — Re-edit kilometraje, declaración del conductor, fotos, resultado; consistent "Siguiente" after a correction

## Acceptance criteria
- From any step of an EN_PROCESO inspection, "Atrás" reaches the previous step, and so on back to the start.
- Changing an answered item (OK→FALLA asks for novedad; FALLA→OK removes it) updates the progress counts immediately.
- After envío, no step allows edits (server rejects; UI shows read-only or redirects).
- tsc, eslint, npm test green; live check as trabajador@ess.local on an inspection the writer creates.

## Checks
TDD: strict / user global config / `npx vitest run`. RDD: off (global).

## Progress / evidence

### Decisions (T1)
- Step order = `construirPasosFlujo` (pure, `lib/inspections/pasos-flujo.ts`), mirrors `getNextStepPath`: medidas -> checklist items one by one (catalog order) -> Documentación as ONE step (`/checklist` list) at its catalog position (last in the seed) -> estado-conductor paso 1..3 -> fotos -> resultado -> confirmar. `getPreviousStepPath` / `getFollowingStepPath` (queries.ts) wrap it with the vehicle-type catalog.
- No `?editar=1` needed. Only blocker found: `/checklist` redirected away when no document was pending, and `categoriasParaLista` only returned Documentación with pending items. Relaxed both (list is always reachable while EN_PROCESO; "Continuar" shows when no document is pending). Item pages, estado-conductor (with `?paso=N`), fotos, resultado, confirmar never redirected on answered steps.
- First step (medidas) "Atrás" goes to `/inspecciones` (inspection stays EN_PROCESO and resumable). Subscreens: novedad -> item page (or the list for documents), foto de novedad -> novedad form, no-puede-operar -> resultado.
- The item page's old "Anterior/Siguiente" (within category) was replaced by "Atrás" (true flow order) and a flow-based "Siguiente" shown only for already-answered items.
- Route: delegated writer (single), trigger: mapping 4+ files and 2+ non-trivial files.
- T1 TDD: RED `npx vitest run lib/inspections/pasos-flujo.test.ts` -> 7 failed (construirPasosFlujo is not a function); `queries.test.ts` -> 2 failed (getPreviousStepPath missing; categoriasParaLista with complete docs returned []). GREEN: 9/9 and 21/21.

## Next step
T1–T3 via one delegated writer on branch `feat/correccion-respuestas-inspeccion` (stacked on `feat/panel-inicio-por-rol`).

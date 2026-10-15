# Feature: novedad-foto-una-pantalla

## Objective
Report a novedad (e.g. "Espejos" in Falla) on a single screen: type, description, optional "¿Dónde?", and the photo capture (with preview), then one "Continuar" that saves everything.

## Problem / Why
User (2026-10-14): "cuando se toma una foto frente a novedades por ejemplo espejos se necesita que se capture la imagen y solo sea darle continuar". Today it takes two screens and two "Continuar" taps: the novedad form (`checklist/[itemId]/novedad`) redirects to a separate photo screen (`novedades/[novedadId]/foto`). User chose option B: everything on one screen.

Compression check (user asked to validate it): the photo is already compressed in the browser before upload (`CapturaFotoInput` -> `comprimirFotoEnNavegador`: long side 1600 px, JPEG 0.75, ~200–350 KB, EXIF/GPS stripped). The new screen must keep that.

## Scope (authorized: "la B, todo en una sola pantalla")
- The generic novedad screen (`app/(worker)/inspecciones/[id]/checklist/[itemId]/novedad/page.tsx`) gets an optional photo field: "Tomar foto" (camera, `capture="environment"`), compressed in the browser, local preview, "Cambiar foto" to retake. No auto-submit.
- One "Continuar" saves the novedad and, if a photo was taken, attaches it; then goes to the next step (`getNextStepPath`), no longer to the photo screen.
- Correction of a novedad that already has a photo: show that a photo is attached (no second upload; one photo per novedad stays the rule).
- Out of scope: the inline "Rayones" flow (`pideUbicacion`) and the separate photo screen, which stay as they are.

## Constraints
- Reuse the server rules: `responderItem` + `subirFotoNovedad` (auth, ownership, EN_PROCESO, one photo per novedad, `validarArchivo`, signature invalidation). Do not duplicate them.
- Keep client compression (`comprimirFotoEnNavegador`) and `capture="environment"`. Server action body limit is 10 MB.
- TDD strict, runner `npx vitest run`. Mobile-first, Spanish UI copy.
- Do not stage `.atl/`, `docs/`, `next.config.ts` (unrelated pending changes).

## Tasks
- [x] T1 — Single-screen novedad + photo (route: delegated writer; 2+ non-trivial files: server action/orchestration + client photo field + page)

## Acceptance criteria
- Espejos -> Falla: one screen with type, description, "Tomar foto" + preview; one "Continuar" saves novedad and photo and goes to the next step.
- Without a photo, "Continuar" still works (photo is optional).
- Uploaded photo arrives compressed (JPEG, long side <= 1600 px).
- tsc, eslint, npm test green; live check as trabajador.

## Progress
- 2026-10-14: branch `feat/novedad-foto-una-pantalla` created from `feat/autorizacion-datos` (not merged into main yet).
- 2026-10-14 T1 done (route: delegated writer, 2+ non-trivial files).
  - TDD: strict, source: user config, runner `npx vitest run`.
  - RED: `npx vitest run lib/inspections/actions.test.ts` -> 5 failed (`guardarNovedadConFoto is not a function`).
  - GREEN: same command -> 80 passed.
  - Implemented: `guardarNovedadConFoto` (lib/inspections/actions.ts), `CampoFotoNovedad` + `BotonGuardarNovedad` (app/(worker)/inspecciones/_components/CampoFotoNovedad.tsx), novedad page uses them and shows "Foto adjuntada" when the novedad already has a photo.
  - Verification: `npx vitest run`: 59 files, 818 tests passed; `npx tsc --noEmit`: clean; `npx eslint` on changed files: clean.
  - Commit: `80752ba`. RDD off; assess (committed-only, untracked excluded): medium, under_budget.
  - Parent fix (`fix(novedades): limpiar la vista previa si se cancela la camara`): clear the preview when the camera is cancelled and the input is emptied. tsc + eslint clean.
  - Pending: live check as trabajador on a real phone.

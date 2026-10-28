# Fotos de llantas por posicion

## Objective
After the tire checklist item, require one photo per tire: MOTO 2 photos (front, rear), CARRO 4 photos (front-left, front-right, rear-left, rear-right). Today only MOTO asks for one photo showing both tires; CARRO asks none.

## Problem / why
User request 2026-10-28: better evidence of each tire's condition, for both vehicle types.

## Decisions (parent, reversible)
- New `TipoFotoInspeccion` values (migration `ALTER TYPE ... ADD VALUE`): `LLANTA_DELANTERA`, `LLANTA_TRASERA` (moto); `LLANTA_DELANTERA_IZQUIERDA`, `LLANTA_DELANTERA_DERECHA`, `LLANTA_TRASERA_IZQUIERDA`, `LLANTA_TRASERA_DERECHA` (carro). `@@unique([inspectionId, tipo])` keeps one row per position.
- Single flow step (existing `foto-llantas` page) right after the tire item ("Llantas" moto, "Llantas, incluye repuesto" carro), with one upload slot per tire; spare tire not photographed.
- Legacy `LLANTAS` stays in the enum, no longer required or uploadable; PDF still shows it when present (historical evidence). No backfill, no deletes.
- In-progress inspections at deploy: must take the new photos before submitting.
- Approver/consulta screens don't show daily photos today; PDF only (unchanged scope).

## Scope
fotos-flujo, pasos-flujo, queries (required photos, next step, getFotosInspeccion), actions (submit validation), foto-actions (allowed types per vehicle), foto-upload-http (allowlist), foto-llantas page, SubirFotoInspeccion, guia-foto, PDF helpers/document, migration + schema, tests.

## Constraints
- Strict TDD; `npm test` (vitest), `npx tsc --noEmit`, `npm run lint`. Prisma client must be regenerated after schema change (`npx prisma generate`; emits TS).
- Delivery strategy: ask-on-risk (forecast ~400-600 lines incl. tests).

## Tasks
- [x] T1 - Migration + rule + upload + flow page + PDF + tests. Route: delegated writer (2+ non-trivial files).
- [x] T2 - Parent spot check, commit.

## Progress / evidence
- Branch `feat/fotos-llantas-por-posicion` from `main` @ ecdeebe.
- T1 (delegated writer): migration `20261028120000_foto_inspeccion_llantas_por_posicion` (applied to test DB via `npm run prisma:migrate:test` and dev DB via `prisma migrate deploy`); per-vehicle tire lists in `lib/inspections/fotos-flujo.ts`; required photos/next step/upload allowlist/per-vehicle upload rule; `foto-llantas` page with one slot per tire; PDF rows of 3 with labelled tire photos, legacy LLANTAS still shown. RED observed: 40 failing tests before implementation.
- Checks: `npm test` 83 files / 1098 green and `tsc --noEmit` clean (parent re-run); `npm run lint` clean (writer).
- NOT verified: browser, real S3 upload, PDF visual layout with 6 photos, 4-slot page on device.
- Size: ~630 additions / 170 deletions (majority tests); single coherent behavior, one work-unit commit. PR slicing decision pending with user.
- Known gaps: "Faltan fotos obligatorias" lists raw enum names (pre-existing); CARRO guide reuses spare-tire reference image.
- RDD: not run (review mode not assessed in this session).

## Next step
User visual check (worker flow moto/carro, PDF); push/PR.

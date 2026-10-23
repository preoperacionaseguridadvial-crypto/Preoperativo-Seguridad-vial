# Checklist Bueno/Malo y nuevo orden del flujo

## Objective
Change the worker inspection checklist (MOTO and CARRO) to "Bueno / Malo" wording, reorder the flow as requested by the user, and add a tire photo to the MOTO inspection.

## Scope (authorized by the user on 2026-10-23)
- Labels: binary items show "Bueno" (was "OK") and "Malo" (was "X Falla / daño / faltante") everywhere they are rendered (worker flow, current-answer chips, novedad screen title, consulta detail, approvals detail, approval-confirmation motives, PDF). Stored values stay `OK` / `FALLA` (display-only change, no data migration). Fluid items (aceite, liquido de frenos, refrigerante) keep "Bueno / Bajo".
- Items stay as they are today (no splitting): CARRO lights item stays merged; turn signals stay inside the lights item.
- CARRO "Llantas (incluye repuesto)": a single item whose guide shows BOTH images (tire and spare `public/checklist/llantas-repuesto.webp`).
- "(si aplica)": informative text only, for MOTO on "Nivel del liquido de frenos" and "Nivel refrigerante". No "No aplica" option, no enum change.
- Flow order:
  1. Kilometraje (`medidas`) first.
  2. Documentos (Licencia de transito / tarjeta de propiedad, SOAT, Revision tecnico-mecanica, Licencia de conduccion, Cedula).
  3. Estado y funcionamiento:
     - MOTO: Luces externas (con direccionales), Llantas, Fotografia de las llantas (NEW, required), Nivel de aceite, Nivel liquido de frenos (si aplica), Frenos, Nivel refrigerante (si aplica), Espejos, Canguro de emergencia vial, Casco.
     - CARRO: Luces (merged item), Llantas (incluye repuesto), Nivel de aceite, Nivel liquido de frenos, Frenos, Nivel refrigerante, Cinturones, Limpiabrisas, Espejos, Botiquin, Extintor.
  4. Estado del conductor (3 questions, unchanged).
  5. Fotos lateral y placa (unchanged; the "fotografia diaria lateral" of the user's list is this same photo, taken once).
  6. Resultado "apto para operar", then confirmar/firma (unchanged).

## Out of scope
- Renaming or splitting catalog items, "No aplica" value, changes to estado del conductor.

## Constraints
- Existing production data: catalog changes must apply to existing DBs (data migration) and to fresh DBs (seed) with the same result; never create duplicate items; history must keep rendering.
- Strict TDD: on. Runner `npm test` (vitest). Next.js 16 docs in `node_modules/next/dist/docs/`.

## Tasks
- [x] T1 - Bueno/Malo wording everywhere (display only) + "(si aplica)" hint for MOTO fluids + CARRO tire item shows both guide images. Route: delegated writer.
- [x] T2 - Flow order: kilometraje -> documentos -> items in the requested interleaved order -> rest unchanged; applied by data migration + seed. Route: delegated writer.
- [x] T3 - MOTO tire photo (required) right after the Llantas item, stored like the daily photos, shown in detail/PDF. Route: delegated writer.
- [ ] T4 - Full checks, live run-through as a worker (moto and carro), commit per task.

## Progress / evidence
- T1 2adca9c: shared helper lib/inspections/etiquetas-respuesta.ts; RED (module missing, motives/PDF tests) -> GREEN 968. Carro tire item already shows llantas-repuesto.webp (single image showing both); no change needed.
- T2 5dcf53b: ChecklistItem.orden = global flow order; pasosChecklistEnOrden in pasos-flujo.ts; catalog moved to prisma/catalogo-checklist.ts; migration 20261023150000_orden_flujo_checklist (UPDATE by category+name) applied to dev and test; RED 4+5 -> GREEN 977.
- T3 03bb0f8: TipoFotoInspeccion LLANTAS (migration 20261023160000), step /inspecciones/[id]/foto-llantas (MOTO only), required on send, PDF block. Tests written first but RED observed only via stub afterwards (6 fail). 1001 passed.
- Checks: npm test 1001 passed; tsc and lint clean. Live redirect chains MOTO/CARRO confirmed in order; labels Bueno/Malo, (si aplica) only moto fluids. Not live-checked: real photo upload (out-of-hours window), browser clicks, full sign-and-send, PDF visual.
- Branch `feat/checklist-bueno-malo` from `main` @ dd6e957.

## Next step
T4: user walk-through on localhost (moto and carro) within the inspection time window; then push/PR.

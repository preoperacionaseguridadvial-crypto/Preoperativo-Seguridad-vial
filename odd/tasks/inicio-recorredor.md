# Inicio del recorredor - rediseno

## Objective
Redesign the worker start screen `/inspecciones` following the user's mockup (2026-10-23), using the provided background `public/inspecciones/fondo-recorredor.webp`.

## Scope
- Header band over the background image: eyebrow "SEGURIDAD VIAL, SIEMPRE CONTIGO", title "Inspección preoperacional", subtitle "Revisa tu vehículo antes de salir a operar.", right tagline "CONDUCTORES MÁS SEGUROS / VÍAS MÁS SEGURAS".
- "Unidad asignada" card: vehicle photo (if available), yellow plate chip, type (Moto/Carro), brand/model · year · color, SOAT / Tecnomecánica status chips.
- Side card: "Duración estimada 5 – 7 min / 5 pasos para completar" and "Inspección obligatoria / Tu seguridad y la de todos empieza aquí."
- Full-width primary button "Iniciar inspección" (or "Continuar inspección" when one is in progress, as today).
- "Qué vas a revisar": 5 steps in the new flow order: Kilometraje; Checklist del vehículo (Documentos y revisión de cada ítem, N ítems); Declaración del conductor (3 preguntas); Fotos del vehículo (foto lateral y placa); Declaración final (si la unidad está en condiciones de operar).
- Keep every existing behavior: error banner (`?error=`), in-progress inspections and cancel, document alerts, no-vehicle state, out-of-hours handling.

## Constraints
- Strict TDD on for pure logic; `npm test`. Next.js 16 docs in `node_modules/next/dist/docs/`.

## Tasks
- [x] T1 - UI redesign of `/inspecciones` (+ pure helpers with tests if needed). Route: delegated writer.
- [x] T2 - Checks, live check as worker, commit.

## Progress / evidence
- T1 2ea5113: page + BotonIniciarInspeccion rewritten, lib/inspections/pasos-inicio.ts (+test). RED (module missing) -> GREEN 4/4. npm test 1005 passed; tsc and lint clean.
- T2 live (temp workers tagged tmp-live-recorredor-*, cleaned up): MOTO 14 items, CARRO 16 items; hero, plate, chips, 5 steps, Iniciar button present. Not checked: rendered layout/mobile, in-progress Continuar button, ?error= banner.
- Deviations: big Continuar button added when a reusable inspection exists (duplicates list Continuar); no year field on Vehicle.
- Branch `feat/inicio-recorredor` from `feat/checklist-bueno-malo` @ def4495. Background converted to WebP (2000x667, 21 KB).

## Next step
User visual check on localhost; push/PR order: checklist-bueno-malo then inicio-recorredor (stacked).
